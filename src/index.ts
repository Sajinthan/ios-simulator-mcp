import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { exec, spawn } from "child_process";
import { promisify } from "util";
import { z } from "zod";

const execAsync = promisify(exec);

async function run(cmd: string): Promise<string> {
  const { stdout, stderr } = await execAsync(cmd);
  return stdout || stderr;
}

const recordings = new Map<string, ReturnType<typeof spawn>>();

const server = new McpServer({ name: "ios-simulator-mcp", version: "1.0.0" });

// ── simctl tools ────────────────────────────────────────────────────────────

server.tool("list_simulators", "List all available iOS simulators", {}, async () => {
  const out = await run("xcrun simctl list devices --json");
  return { content: [{ type: "text", text: out }] };
});

server.tool("boot_simulator", "Boot an iOS simulator and open the Simulator app", {
  udid: z.string().describe("Simulator UDID"),
}, async ({ udid }) => {
  await run(`xcrun simctl boot "${udid}"`);
  await run("open -a Simulator");
  return { content: [{ type: "text", text: `Booted ${udid}` }] };
});

server.tool("shutdown_simulator", "Shutdown a booted simulator", {
  udid: z.string(),
}, async ({ udid }) => {
  await run(`xcrun simctl shutdown "${udid}"`);
  return { content: [{ type: "text", text: `Shutdown ${udid}` }] };
});

server.tool("install_app", "Install an .app bundle on a simulator", {
  udid: z.string(),
  app_path: z.string().describe("Absolute path to .app bundle"),
}, async ({ udid, app_path }) => {
  await run(`xcrun simctl install "${udid}" "${app_path}"`);
  return { content: [{ type: "text", text: "App installed" }] };
});

server.tool("launch_app", "Launch an installed app", {
  udid: z.string(),
  bundle_id: z.string(),
}, async ({ udid, bundle_id }) => {
  await run(`xcrun simctl launch "${udid}" "${bundle_id}"`);
  return { content: [{ type: "text", text: `Launched ${bundle_id}` }] };
});

server.tool("terminate_app", "Terminate a running app", {
  udid: z.string(),
  bundle_id: z.string(),
}, async ({ udid, bundle_id }) => {
  await run(`xcrun simctl terminate "${udid}" "${bundle_id}"`);
  return { content: [{ type: "text", text: `Terminated ${bundle_id}` }] };
});

server.tool("screenshot", "Take a screenshot of the simulator screen", {
  udid: z.string(),
  output_path: z.string().default("/tmp/sim-screenshot.png"),
}, async ({ udid, output_path }) => {
  await run(`xcrun simctl io "${udid}" screenshot "${output_path}"`);
  return { content: [{ type: "text", text: `Screenshot saved to ${output_path}` }] };
});

server.tool("open_url", "Open a URL or deep link in the simulator", {
  udid: z.string(),
  url: z.string(),
}, async ({ udid, url }) => {
  await run(`xcrun simctl openurl "${udid}" "${url}"`);
  return { content: [{ type: "text", text: `Opened ${url}` }] };
});

server.tool("get_booted_udid", "Get the UDID of the currently booted simulator", {}, async () => {
  const out = await run("xcrun simctl list devices booted --json");
  return { content: [{ type: "text", text: out }] };
});

server.tool("get_screen_info", "Get the screen size in logical points — use these dimensions to correctly map screenshot pixel coordinates to tap coordinates", {
  udid: z.string(),
}, async ({ udid }) => {
  const axOut = await run(`idb ui describe-all --udid "${udid}"`);
  const elements = JSON.parse(axOut);
  const app = elements.find((e: { role: string }) => e.role === "AXApplication");
  if (!app) return { content: [{ type: "text", text: "Could not determine screen size" }] };
  const { width, height } = app.frame;
  return {
    content: [{
      type: "text",
      text: `Screen size: ${width} x ${height} points\nUse these as your coordinate space when tapping. Screenshot pixels must be scaled accordingly.`
    }]
  };
});

// ── idb tools (requires: brew install idb-companion && pip install fb-idb) ──

server.tool("tap", "Tap at x,y coordinates on the simulator screen", {
  udid: z.string(),
  x: z.number(),
  y: z.number(),
}, async ({ udid, x, y }) => {
  await run(`idb ui tap ${x} ${y} --udid "${udid}"`);
  return { content: [{ type: "text", text: `Tapped (${x}, ${y})` }] };
});

server.tool("type_text", "Type text into the currently focused input", {
  udid: z.string(),
  text: z.string(),
}, async ({ udid, text }) => {
  await run(`idb ui text "${text}" --udid "${udid}"`);
  return { content: [{ type: "text", text: `Typed: ${text}` }] };
});

server.tool("swipe", "Swipe from one point to another", {
  udid: z.string(),
  x1: z.number(), y1: z.number(),
  x2: z.number(), y2: z.number(),
  duration: z.number().default(0.5).describe("Swipe duration in seconds"),
}, async ({ udid, x1, y1, x2, y2, duration }) => {
  await run(`idb ui swipe ${x1} ${y1} ${x2} ${y2} --duration ${duration} --udid "${udid}"`);
  return { content: [{ type: "text", text: `Swiped (${x1},${y1}) → (${x2},${y2})` }] };
});

server.tool("press_button", "Press a hardware button (HOME, LOCK, SIRI, APPLE_PAY, SIDE_BUTTON, VOLUME_UP, VOLUME_DOWN)", {
  udid: z.string(),
  button: z.enum(["HOME", "LOCK", "SIRI", "APPLE_PAY", "SIDE_BUTTON", "VOLUME_UP", "VOLUME_DOWN"]),
}, async ({ udid, button }) => {
  await run(`idb ui button --name ${button} --udid "${udid}"`);
  return { content: [{ type: "text", text: `Pressed ${button}` }] };
});

server.tool("describe_ui", "Get the full accessibility tree of the current screen", {
  udid: z.string(),
}, async ({ udid }) => {
  const out = await run(`idb ui describe-all --udid "${udid}"`);
  return { content: [{ type: "text", text: out }] };
});

// ── start ────────────────────────────────────────────────────────────────────

server.tool("set_location", "Set the simulated GPS location", {
  udid: z.string(),
  latitude: z.number(),
  longitude: z.number(),
}, async ({ udid, latitude, longitude }) => {
  await run(`xcrun simctl location "${udid}" set ${latitude},${longitude}`);
  return { content: [{ type: "text", text: `Location set to ${latitude}, ${longitude}` }] };
});

server.tool("add_media", "Add a photo or video to the simulator's photo library", {
  udid: z.string(),
  file_path: z.string().describe("Absolute path to image or video file"),
}, async ({ udid, file_path }) => {
  await run(`xcrun simctl addmedia "${udid}" "${file_path}"`);
  return { content: [{ type: "text", text: `Media added: ${file_path}` }] };
});

server.tool("set_status_bar", "Override the simulator status bar (time, battery, wifi, etc.)", {
  udid: z.string(),
  time: z.string().optional().describe("Time string e.g. '9:41'"),
  battery_level: z.number().min(0).max(100).optional(),
  battery_state: z.enum(["charging", "charged", "discharging"]).optional(),
  wifi_mode: z.enum(["active", "searching", "failed", "notRunning"]).optional(),
}, async ({ udid, time, battery_level, battery_state, wifi_mode }) => {
  const args: string[] = [];
  if (time) args.push(`--time "${time}"`);
  if (battery_level !== undefined) args.push(`--batteryLevel ${battery_level}`);
  if (battery_state) args.push(`--batteryState ${battery_state}`);
  if (wifi_mode) args.push(`--wifiMode ${wifi_mode}`);
  await run(`xcrun simctl status_bar "${udid}" override ${args.join(" ")}`);
  return { content: [{ type: "text", text: `Status bar updated` }] };
});

server.tool("clear_status_bar", "Reset the status bar overrides back to default", {
  udid: z.string(),
}, async ({ udid }) => {
  await run(`xcrun simctl status_bar "${udid}" clear`);
  return { content: [{ type: "text", text: "Status bar cleared" }] };
});

server.tool("clear_app_data", "Clear all data for an app (uninstall and reinstall)", {
  udid: z.string(),
  bundle_id: z.string(),
}, async ({ udid, bundle_id }) => {
  await run(`xcrun simctl privacy "${udid}" reset all "${bundle_id}"`);
  return { content: [{ type: "text", text: `App data cleared for ${bundle_id}` }] };
});

server.tool("record_video", "Start recording the simulator screen to a file", {
  udid: z.string(),
  output_path: z.string().default("/tmp/sim-recording.mp4"),
}, async ({ udid, output_path }) => {
  if (recordings.has(udid)) return { content: [{ type: "text", text: "Already recording" }] };
  const proc = spawn("xcrun", ["simctl", "io", udid, "recordVideo", "--force", output_path]);
  recordings.set(udid, proc);
  return { content: [{ type: "text", text: `Recording started → ${output_path}` }] };
});

server.tool("stop_recording", "Stop an active screen recording", {
  udid: z.string(),
}, async ({ udid }) => {
  const proc = recordings.get(udid);
  if (!proc) return { content: [{ type: "text", text: "No active recording" }] };
  proc.kill("SIGINT");
  recordings.delete(udid);
  return { content: [{ type: "text", text: "Recording stopped" }] };
});

server.tool("shake", "Shake the simulator device", {
  udid: z.string(),
}, async ({ udid }) => {
  await run(`xcrun simctl io "${udid}" shake`);
  return { content: [{ type: "text", text: "Device shaken" }] };
});

const transport = new StdioServerTransport();
await server.connect(transport);
