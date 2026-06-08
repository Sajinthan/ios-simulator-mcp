# ios-simulator-mcp

An MCP (Model Context Protocol) server that lets AI agents control the iOS Simulator — boot devices, install apps, interact with UI, take screenshots, and more.

## Prerequisites

- Xcode + Command Line Tools (`xcode-select --install`)
- [idb](https://github.com/facebook/idb) for UI interaction:
  ```bash
  brew install idb-companion
  pipx install fb-idb
  ```
- Node.js 18+

## Installation

```bash
git clone https://github.com/Sajinthan/ios-simulator-mcp
cd ios-simulator-mcp
npm install
npm run build
```

## Connect to Kiro / Claude Desktop

Add to your MCP config (`~/.kiro/settings/mcp.json` or `claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "ios-simulator": {
      "command": "node",
      "args": ["/absolute/path/to/ios-simulator-mcp/dist/index.js"]
    }
  }
}
```

## Tools

### Simulator Control
| Tool | Description |
|---|---|
| `list_simulators` | List all available simulators |
| `boot_simulator` | Boot a simulator and open Simulator.app |
| `shutdown_simulator` | Shutdown a booted simulator |
| `get_booted_udid` | Get the currently booted simulator's UDID |

### App Management
| Tool | Description |
|---|---|
| `install_app` | Install an `.app` bundle |
| `launch_app` | Launch an app by bundle ID |
| `terminate_app` | Terminate a running app |
| `clear_app_data` | Reset app permissions and data |

### UI Interaction (via idb)
| Tool | Description |
|---|---|
| `tap` | Tap at x,y coordinates (logical points) |
| `swipe` | Swipe between two points |
| `type_text` | Type text into the focused input |
| `press_button` | Press HOME, LOCK, SIRI, VOLUME_UP/DOWN, etc. |
| `describe_ui` | Get full accessibility tree with element positions |
| `shake` | Shake the device |

### Media & Location
| Tool | Description |
|---|---|
| `screenshot` | Take a screenshot |
| `record_video` | Start recording screen to `.mp4` |
| `stop_recording` | Stop active screen recording |
| `add_media` | Add photo/video to the photo library |
| `open_url` | Open a URL or deep link |
| `set_location` | Set simulated GPS coordinates |

### Status Bar
| Tool | Description |
|---|---|
| `set_status_bar` | Override time, battery, wifi in the status bar |
| `clear_status_bar` | Reset status bar to default |

### Utility
| Tool | Description |
|---|---|
| `get_screen_info` | Get screen size in logical points for coordinate mapping |

## Coordinate System

The simulator uses **logical points**, not pixels. Screenshots may be at a higher resolution. Use `get_screen_info` to get the logical screen size, then scale your coordinates:

```
tap_x = screenshot_pixel_x * (screen_width_pts / screenshot_width_px)
tap_y = screenshot_pixel_y * (screen_height_pts / screenshot_height_px)
```

Or use `describe_ui` to get exact element positions in points directly.
