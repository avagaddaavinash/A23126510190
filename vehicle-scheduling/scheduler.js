import 'dotenv/config';
import { Log } from '../logging-middleware/logger.js';

const BASE_URL = 'http://4.224.186.213';
const TOKEN = process.env.AFFORDMED_TOKEN || '';

const HEADERS = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${TOKEN}`,
};

async function fetchDepots() {
    await Log('backend', 'info', 'scheduler', 'Fetching depot list from evaluation server');
    try {
        const res = await fetch(`${BASE_URL}/evaluation-service/depots`, { headers: HEADERS });
        const data = await res.json();

        if (!res.ok) {
            await Log('backend', 'error', 'scheduler', `Depot fetch failed: HTTP ${res.status}`);
            throw new Error(`Depot fetch failed: ${res.status}`);
        }

        await Log('backend', 'info', 'scheduler', `Fetched ${data.depots.length} depots successfully`);
        return data.depots;
    } catch (err) {
        await Log('backend', 'fatal', 'scheduler', `Cannot reach depot API: ${err.message}`);
        throw err;
    }
}

async function fetchVehicles() {
    await Log('backend', 'info', 'scheduler', 'Fetching vehicle task list from evaluation server');
    try {
        const res = await fetch(`${BASE_URL}/evaluation-service/vehicles`, { headers: HEADERS });
        const data = await res.json();

        if (!res.ok) {
            await Log('backend', 'error', 'scheduler', `Vehicle fetch failed: HTTP ${res.status}`);
            throw new Error(`Vehicle fetch failed: ${res.status}`);
        }

        await Log('backend', 'info', 'scheduler', `Fetched ${data.vehicles.length} vehicle tasks successfully`);
        return data.vehicles;
    } catch (err) {
        await Log('backend', 'fatal', 'scheduler', `Cannot reach vehicles API: ${err.message}`);
        throw err;
    }
}

function knapsack(tasks, capacity) {
    const n = tasks.length;
    const W = capacity;

    const dp = Array.from({ length: n + 1 }, () => new Array(W + 1).fill(0));

    for (let i = 1; i <= n; i++) {
        const { Duration: wt, Impact: val } = tasks[i - 1];
        for (let w = 0; w <= W; w++) {

            dp[i][w] = dp[i - 1][w];
            // Take item i (if it fits)
            if (wt <= w) {
                dp[i][w] = Math.max(dp[i][w], dp[i - 1][w - wt] + val);
            }
        }
    }

    const selectedTasks = [];
    let w = W;
    for (let i = n; i >= 1; i--) {
        if (dp[i][w] !== dp[i - 1][w]) {
            selectedTasks.push(tasks[i - 1]);
            w -= tasks[i - 1].Duration;
        }
    }

    return {
        maxImpact: dp[n][W],
        selectedTasks: selectedTasks.reverse(),
    };
}

async function runScheduler() {
    await Log('backend', 'info', 'scheduler', 'Vehicle Maintenance Scheduler started');

    const depots = await fetchDepots();
    const vehicles = await fetchVehicles();

    await Log('backend', 'debug', 'scheduler',
        `Running knapsack for ${depots.length} depots with ${vehicles.length} tasks`);

    const results = [];

    for (const depot of depots) {
        const { ID, MechanicHours } = depot;

        await Log('backend', 'info', 'scheduler',
            `Processing Depot #${ID} — budget: ${MechanicHours} mechanic-hours`);

        const { maxImpact, selectedTasks } = knapsack(vehicles, MechanicHours);

        const totalDuration = selectedTasks.reduce((sum, t) => sum + t.Duration, 0);

        await Log('backend', 'info', 'scheduler',
            `Depot #${ID} — selected ${selectedTasks.length} tasks, ` +
            `total impact: ${maxImpact}, hours used: ${totalDuration}/${MechanicHours}`);

        results.push({
            depotID: ID,
            mechanicHours: MechanicHours,
            maxImpact,
            hoursUsed: totalDuration,
            hoursRemaining: MechanicHours - totalDuration,
            taskCount: selectedTasks.length,
            selectedTasks,
        });
    }

    console.log('\n' + '═'.repeat(70));
    console.log('  VEHICLE MAINTENANCE SCHEDULER — RESULTS');
    console.log('═'.repeat(70));

    for (const r of results) {
        console.log(`\n  Depot #${r.depotID}`);
        console.log(`  ${'─'.repeat(40)}`);
        console.log(`  Budget        : ${r.mechanicHours} hours`);
        console.log(`  Hours Used    : ${r.hoursUsed} hours`);
        console.log(`  Hours Remaining: ${r.hoursRemaining} hours`);
        console.log(`  Max Impact    : ${r.maxImpact}`);
        console.log(`  Tasks Selected: ${r.taskCount}`);
        console.log(`\n  Selected Tasks:`);
        r.selectedTasks.forEach((t, idx) => {
            console.log(`    ${idx + 1}. [${t.TaskID}]  Duration: ${t.Duration}h  Impact: ${t.Impact}`);
        });
    }

    console.log('\n' + '═'.repeat(70));

    await Log('backend', 'info', 'scheduler',
        `Scheduler completed. Processed ${results.length} depots.`);

    return results;
}

runScheduler().catch(async (err) => {
    await Log('backend', 'fatal', 'scheduler', `Scheduler crashed: ${err.message}`);
    console.error(err);
    process.exit(1);
});
