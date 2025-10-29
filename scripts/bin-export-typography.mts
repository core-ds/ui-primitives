import { exportTypography } from "./export-typography.mjs";
import { AsyncFunctionArguments } from "@actions/github-script";

export default async ({ exec, context, github }: AsyncFunctionArguments) => {
    await exec.exec("git", ["config", "--global", "user.name", `"github-actions[bot]"`]);
    await exec.exec("git", ["config", "--global", "user.email", `"github-actions[bot]@users.noreply.github.com"`]);

    const targetBranch = "feat/update-typography";

    let shouldReset = true;

    try {
        await exec.exec("git", ["checkout", targetBranch]);
    } catch {
        await exec.exec("git", ["checkout", "-b", targetBranch]);
        shouldReset = false;
    }

    if (shouldReset) {
        await exec.exec("git", ["reset", "--hard", context.sha]);
    }

    await exportTypography();

    await exec.exec("git", ["add", "."]);

    const status = await exec.getExecOutput("git", ["status", "--porcelain"]);

    if (status.stdout.split("\n").some((line) => /^(A|M|R)\s+styles\/typography.*.json$/.test(line))) {
        await exec.exec("git", ["commit", "-m", "feat: updated typography"]);
        await exec.exec("git", ["push", "origin", `HEAD:${targetBranch}`, "--force"]);

        const { repo, owner } = context.repo;
        const branch = context.ref.replace("refs/heads/", "");

        const existingPullRequests = await github.rest.pulls.list({
            owner,
            repo,
            state: "open",
            base: branch,
            head: `${owner}:${targetBranch}`,
        });

        if (existingPullRequests.data.length === 0) {
            await github.rest.pulls.create({
                owner: owner,
                repo: repo,
                base: branch,
                head: targetBranch,
                title: "feat: updated typography",
            });
        }
    }
};
