const TEST_SERVER_LOG_URL = "http://4.224.186.213/evaluation-service/logs";

const VALID_STACKS = ["backend", "frontend"];
const VALID_LEVELS = ["debug", "info", "warn", "error", "fatal"];
const VALID_PACKAGES = [
    //packages backend
    "cache", "controller", "cron_job", "db", "domain", "handler", "repository", "route", "service",
    //packages frontend
    "api", "component", "hook", "page", "state", "style",
    //packages both backend and frontend
    "auth", "config", "middleware", "utils",
];

let cachedToken = null;

function setAuthToken(token) {
    cachedToken = token;
}

async function Log(stack, level, package_, message) {
    const normStack = String(stack).toLowerCase();
    const normLevel = String(level).toLowerCase();
    const normPackage = String(package_).toLowerCase();

    if (!VALID_STACKS.includes(normStack)) {
        throw new Error(`Log(): invalid stack "${stack}". Must be one of ${VALID_STACKS.join(", ")}`);
    }
    if (!VALID_LEVELS.includes(normLevel)) {
        throw new Error(`Log(): invalid level "${level}". Must be one of ${VALID_LEVELS.join(", ")}`);
    }
    if (!VALID_PACKAGES.includes(normPackage)) {
        throw new Error(`Log(): invalid package "${package_}". Must be one of ${VALID_PACKAGES.join(", ")}`);
    }

    const body = {
        stack: normStack,
        level: normLevel,
        package: normPackage,
        message: String(message),
    };

    try {
        const headers = { "Content-Type": "application/json" };
        if (cachedToken) {
            headers["Authorization"] = `Bearer ${cachedToken}`;
        }

        const response = await fetch(TEST_SERVER_LOG_URL, {
            method: "POST",
            headers,
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const text = await response.text().catch(() => "");
            process.stderr.write(
                `[logging-middleware] Log API responded ${response.status}: ${text}\n`
            );
            return null;
        }

        return await response.json();
    } catch (err) {
        process.stderr.write(`[logging-middleware] Failed to send log: ${err.message}\n`);
        return null;
    }
}
export { Log, setAuthToken, VALID_STACKS, VALID_LEVELS, VALID_PACKAGES };
