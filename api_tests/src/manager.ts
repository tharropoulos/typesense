import { rmSync, mkdirSync, existsSync, writeFileSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { env } from "bun";
import { networkInterfaces } from "node:os";
import { fetchMultiNode } from "./request";

type ServerInstance = {
  process: Bun.Subprocess;
  name: string;
  port: number;
};

export type MultiNodeConfig = {
  name: string;
  port: number;
  peerPort: number;
  dataDir: string;
  logDir: string;
  analyticsDir: string;
};

export class TypesenseProcessManager {
  baseDir: string;
  binaryPath: string;
  ipAddress: string;
  nodesFile: string;
  processes: Map<string, ServerInstance> = new Map();
  static multiNodeConfigs: MultiNodeConfig[] = [
    { name: "multi-node1", port: 5108, peerPort: 5107, dataDir: "typesense-data-1", logDir: "typesense-1", analyticsDir: "typesense-data-1/analytics_db" },
    { name: "multi-node2", port: 6108, peerPort: 6107, dataDir: "typesense-data-2", logDir: "typesense-2", analyticsDir: "typesense-data-2/analytics_db" },
    { name: "multi-node3", port: 7108, peerPort: 7107, dataDir: "typesense-data-3", logDir: "typesense-3", analyticsDir: "typesense-data-3/analytics_db" },
  ];
  static additionalConfigs = [
    "--enable-cors",
    "--enable-search-analytics",
    "--analytics-flush-interval=3600",
    "--analytics-minute-rate-limit=1000"
  ]

  constructor(
    baseDir: string = env.TYPESENSE_DATA_DIR!,
    binaryPath: string = env.TYPESENSE_BINARY_PATH!,
  ) {
    this.baseDir = baseDir;
    this.binaryPath = binaryPath;
    this.ipAddress = this.getIpAddress();
    this.nodesFile = join(this.baseDir, "nodes");

    this.installSignalHandlers();
  }

  cleanDataDirs() {
    const dirs = [
      "typesense-data",
      "typesense-data/analytics_db",
      "typesense-data-1", "typesense-data-2", "typesense-data-3",
      "typesense-data-1/analytics_db", "typesense-data-2/analytics_db", "typesense-data-3/analytics_db",
      "logs/typesense",
      "logs/typesense-1", "logs/typesense-2", "logs/typesense-3",
      "snapshot/single-node",
      "snapshot/multi-node"
    ];

    for (const dir of dirs) {
      const fullPath = join(this.baseDir, dir);
      if (existsSync(fullPath)) rmSync(fullPath, { recursive: true, force: true });
      mkdirSync(fullPath, { recursive: true });
    }
  }

  private spawnServer(name: string, args: string[], port: number) {
    const proc = Bun.spawn([this.binaryPath, ...args], {
      stdout: "pipe",
      stderr: "pipe",
      env: process.env,
      killSignal: "SIGINT",
    });

    this.processes.set(name, { process: proc, name, port });
  }

  async startSingleNode(dataDir: string = "typesense-data", port: number = 8108, peeringPort: number = 8107, name: string = "single-node") {
    dataDir = join(this.baseDir, dataDir);
    const analyticsDir = join(dataDir, "analytics_db");
    const logDir = join(this.baseDir, "logs", "typesense");
    mkdirSync(logDir, { recursive: true });
    mkdirSync(analyticsDir, { recursive: true });
    const args = [
      `--data-dir=${dataDir}`,
      `--api-key=xyz`,
      `--api-port=${port}`,
      `--api-address=0.0.0.0`,
      `--log-dir=${join(this.baseDir, "logs", "typesense")}`,
      `--analytics-dir=${analyticsDir}`,
      `--peering-address=${this.ipAddress}`,
      `--peering-port=${peeringPort}`,
      ...TypesenseProcessManager.additionalConfigs,
    ];
    this.spawnServer(name, args, port);
    return this.waitForHealth(port);
  }

  getNodesConfigString(configs: MultiNodeConfig[] = TypesenseProcessManager.multiNodeConfigs) {
    return configs
      .map((node) => `${this.ipAddress}:${node.peerPort}:${node.port}`)
      .join(",");
  }

  writeNodesConfig(configs: MultiNodeConfig[] = TypesenseProcessManager.multiNodeConfigs, nodesFile: string = this.nodesFile) {
    writeFileSync(nodesFile, this.getNodesConfigString(configs));
  }

  async startClusterNode(node: MultiNodeConfig, nodesFile: string = this.nodesFile, waitForHealth: boolean = true) {
    const dataDir = join(this.baseDir, node.dataDir);
    const analyticsDir = join(this.baseDir, node.analyticsDir);
    const logDir = join(this.baseDir, "logs", node.logDir);
    mkdirSync(logDir, { recursive: true });
    mkdirSync(analyticsDir, { recursive: true });
    mkdirSync(dataDir, { recursive: true });

    const args = [
      `--nodes=${nodesFile}`,
      `--peering-address=${this.ipAddress}`,
      `--data-dir=${dataDir}`,
      `--api-key=xyz`,
      `--api-port=${node.port}`,
      `--api-address=0.0.0.0`,
      `--peering-port=${node.peerPort}`,
      `--log-dir=${logDir}`,
      `--analytics-dir=${analyticsDir}`,
      ...TypesenseProcessManager.additionalConfigs,
    ];

    this.spawnServer(node.name, args, node.port);
    if (waitForHealth) {
      await this.waitForHealth(node.port);
    }
  }

  async startMultiNode(configs: MultiNodeConfig[] = TypesenseProcessManager.multiNodeConfigs, nodesFile: string = this.nodesFile) {
    const firstNode = configs[0];
    if (!firstNode) {
      throw new Error("At least one node config is required");
    }

    this.writeNodesConfig(configs, nodesFile);

    for (const node of configs) {
      await this.startClusterNode(node, nodesFile, false);
    }

    await this.waitForHealth(firstNode.port);
    await this.electLeader(firstNode.port);

    for (const node of configs) {
      await this.waitForHealth(node.port);
    }
  }

  async stopServer(name: string) {
    const instance = this.processes.get(name);
    if (!instance) return;
    instance.process.kill("SIGINT");
    const timedOut = await Promise.race([
      instance.process.exited.then(() => false),
      new Promise<boolean>((r) => setTimeout(() => r(true), 60000)),
    ]);
    if (timedOut) {
      await this.diagnoseStuckServer(instance);
    }
    this.processes.delete(name);
  }

  // test-only diagnostics for the shutdown hang
  private async diagnoseStuckServer(instance: ServerInstance) {
    const pid = instance.process.pid;
    console.error(`[diag] ${instance.name} (pid ${pid}) still running 60s after SIGINT`);
    try {
      for (const tid of readdirSync(`/proc/${pid}/task`)) {
        const wchan = readFileSync(`/proc/${pid}/task/${tid}/wchan`, "utf8");
        console.error(`[diag] tid ${tid} wchan=${wchan}`);
      }
    } catch (e) {
      console.error(`[diag] could not read /proc: ${e}`);
    }

    const btPath = join(this.baseDir, "logs", `${instance.name}-backtraces.txt`);
    const gdb = Bun.spawnSync(
      ["sudo", "gdb", "-p", String(pid), "-batch", "-ex", "set pagination off", "-ex", "thread apply all bt"],
      { stdout: Bun.file(btPath), stderr: "pipe" },
    );
    console.error(`[diag] ${instance.name} backtraces written to ${btPath} (gdb exit ${gdb.exitCode})`);
    const main = readFileSync(btPath, "utf8").split("\nThread ").find((t) => t.startsWith("1 "));
    console.error(`[diag] ${instance.name} main thread:\nThread ${main ?? "(not found)"}`);

    const stderrText = new Response(instance.process.stderr as ReadableStream).text();
    const stdoutText = new Response(instance.process.stdout as ReadableStream).text();
    const exitedAfterDrain = await Promise.race([
      instance.process.exited.then(() => true),
      new Promise<boolean>((r) => setTimeout(() => r(false), 30000)),
    ]);
    console.error(`[diag] ${instance.name} exited after draining pipes: ${exitedAfterDrain}`);

    if (!exitedAfterDrain) {
      instance.process.kill("SIGKILL");
      await instance.process.exited;
    }
    const stderr = await stderrText;
    const stdout = await stdoutText;
    console.error(`[diag] ${instance.name} stderr ${stderr.length} bytes, tail:\n${stderr.slice(-3000)}`);
    console.error(`[diag] ${instance.name} stdout ${stdout.length} bytes, tail:\n${stdout.slice(-1000)}`);
  }

  async restartSingleNode() {
    await this.stopServer("single-node");
    await this.startSingleNode();
  }

  async restartMultiNode(configs: MultiNodeConfig[] = TypesenseProcessManager.multiNodeConfigs, nodesFile: string = this.nodesFile) {
    await fetchMultiNode(1, "/status");
    for (const node of [...configs].reverse()) {
      await this.stopServer(node.name);
    }
    await this.startMultiNode(configs, nodesFile);
  }

  async electLeader(port: number = 5108) {
    const res = await fetch(`http://localhost:${port}/operations/vote`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-TYPESENSE-API-KEY": "xyz",
      },
    });
    if (!res.ok) throw new Error(`Elect leader failed: ${res.statusText}`);
  }

  async createSnapshot(port: number, snapshot_path: string = "") {
    const snapshotPath = snapshot_path || join(this.baseDir, "snapshot", (port === 8108 ? "single-node" : "multi-node"));
    const url = `http://localhost:${port}/operations/snapshot?snapshot_path=${snapshotPath}`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-TYPESENSE-API-KEY": "xyz",
      },
    });

    if (!res.ok) throw new Error(`Snapshot failed: ${res.statusText}`);
  }

  private async waitForHealth(port: number, timeout = 20000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      try {
        const res = await fetch(`http://localhost:${port}/health`);
        if (res.ok) return;
      } catch {}
      await new Promise((r) => setTimeout(r, 250));
    }
    throw new Error(`Timed out waiting for /health on port ${port}`);
  }

  async shutdown() {
    console.log("🔻 Cleaning up Typesense processes...");
    for (const [name, instance] of this.processes.entries()) {
      console.log(`➡️ Gracefully stopping ${name} (port ${instance.port})`);
      instance.process.kill("SIGTERM");
      await instance.process.exited;
    }
    this.processes.clear();
  };

  private installSignalHandlers() {
    process.on("SIGINT", () => this.shutdown());
    process.on("SIGTERM", () => this.shutdown());
    process.on("exit", () => this.shutdown());

    process.on("uncaughtException", async (err) => {
      console.error("❌ Uncaught Exception:", err);
      await this.shutdown();
      process.exit(1);
    });

    process.on("unhandledRejection", async (reason) => {
      console.error("❌ Unhandled Rejection:", reason);
      await this.shutdown();
      process.exit(1);
    });
  }

  private getIpAddress() {
    const interfaces = networkInterfaces();
    for (const interfaceName in interfaces) {
      const addresses = interfaces[interfaceName];
      if (!addresses) continue;
      for (const address of addresses) {
        if (address.family === "IPv4" && !address.internal) {
          return address.address;
        }
      }
    }
    throw new Error("No IP address found");
  }
}
