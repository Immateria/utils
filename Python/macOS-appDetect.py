#!/usr/bin/env python3
"""
macOS-appDetect.py - Extract version, minimum macOS requirement, architecture,
and additional binary metadata from .app bundles. It uses external
tools: otool, lipo, codesign, etc.
Reqires macOS

Usage:
  appDetect.py [options] <app_bundle(s) or pattern(s)>

Options:
  -j, --json         Produce JSON output.
  -p, --pretty       Pretty print JSON output.
  -u, --uuid         Include Mach-O UUID.
  -d, --deps         Include dynamic library dependencies (structured).
  -s, --sdk          Include SDK version info (LC_VERSION_MIN_MACOSX).
  -c, --codesign     Include code signing details.
  -C, --color {auto,always,never}
                     Colorize output. Default is auto (enabled if stdout is a tty).
  -h, --help         Show this help message and exit.

Examples:
  appDetect.py /Applications/Safari.app
  appDetect.py /Applications/*.app
  appDetect.py -p -u -d -s -c -C always /Applications /path/to/MyApp.app
"""

import argparse
import glob
import json
import os
import plistlib
import re
import subprocess
import sys
from typing import Optional


###############################################################################
# Color & help-formatter code
###############################################################################
def detect_truecolor():
    """Return True if environment variable COLORTERM indicates 24-bit color."""
    return os.getenv("COLORTERM", "").lower() in ["truecolor", "24bit"]

def get_default_color_mappings() -> dict:
    """Return a mapping of semantic role names to color names."""
    return {
        # UI Elements
        "title":       "cyan",      # Titles and main headers
        "heading":     "cyan",      # Section headers
        "prompt":      "cyan",      # User prompts and input requests
        "emphasis":    "bold",      # Emphasized text
        "error":       "red",       # Error messages
        "success":     "green",     # Success messages
        "warning":     "yellow",    # Warning messages

        # Data Elements
        "property":    "cyan",      # Property names in data structures
        "string":      "green",     # String values
        "numeric":     "blue",      # Numeric values
        "keyword":     "yellow",    # Keywords (true, false, null)
        "certificate": "magenta",   # Certificate and security info
        "path":        "cyan",      # File paths
        "dependency":  "green",     # Dependency information
        "version":     "yellow",    # Version numbers
        "arch":        "blue",      # Architecture info

        # No color - must always be present
        "reset":       "reset"      # Reset to default
    }

def get_base_color_codes(use_truecolor: bool) -> dict:
    """Return the base color codes based on terminal capabilities."""
    if use_truecolor:
        return {
            "red":       "\033[38;2;255;85;85m",
            "green":     "\033[38;2;85;255;85m",
            "yellow":    "\033[38;2;255;255;85m",
            "blue":      "\033[38;2;85;85;255m",
            "cyan":      "\033[38;2;85;255;255m",
            "magenta":   "\033[38;2;255;85;255m",
            "bold":      "\033[1m",
            "reset":     "\033[0m",
        }
    else:
        return {
            "red":       "\033[0;31m",
            "green":     "\033[0;32m",
            "yellow":    "\033[1;33m",
            "blue":      "\033[0;34m",
            "cyan":      "\033[0;36m",
            "magenta":   "\033[0;35m",
            "bold":      "\033[1m",
            "reset":     "\033[0m",
        }
def get_color_scheme(enable_color: bool, custom_scheme: Optional[dict] = None) -> dict:
    """
    Return a dict of semantic color codes based on enabled state and custom scheme.

    Args:
        enable_color:  Whether colors should be enabled
        custom_scheme: Optional dict mapping semantic names to color codes

    Returns:
        Dict mapping semantic names to ANSI color codes (or empty strings if disabled)
    """
    # If colors disabled, return empty strings for all keys
    if not enable_color:
        mappings = get_default_color_mappings()
        return {k: "" for k in mappings.keys()}

    # Get base colors and default mappings
    use_truecolor = detect_truecolor()
    base_colors   = get_base_color_codes(use_truecolor)
    mappings      = get_default_color_mappings()

    # Build the scheme by combining mappings with base colors
    colors = {}
    for semantic_name, color_name in mappings.items():
        if semantic_name in base_colors:  # Direct match (for "bold", "reset")
            colors[semantic_name] = base_colors[semantic_name]
            
        else:
            colors[semantic_name] = base_colors[color_name]

    # Apply any custom scheme overrides
    if custom_scheme:
        for k, v in custom_scheme.items():
            if k in colors:
                colors[k] = v

    return colors

def colorize_json(json_text: str, colors: dict) -> str:
    """Apply very lightweight syntax highlighting to JSON text via regex."""
    # Key names in bold property style
    json_text = re.sub(r'("([^"]+)")\s*:',
                      lambda m: f'{colors["property"]}{colors["emphasis"]}{m.group(1)}{colors["reset"]}:',
                      json_text)

    # Process arrays of strings (like codesign_info) - before regular string handling
    json_text = re.sub(r'(\[\s*)((?:"[^"]*",?\s*)+)(\])',
                      lambda m: f'{m.group(1)}{re.sub(r'"([^"]*)"',
                                                     r'{0}"\1"{1}'.format(
                                                         colors["certificate"],
                                                         colors["reset"]
                                                     ),
                                                     m.group(2))}{m.group(3)}',
                      json_text)

    # String values in string style (but not those already colored)
    json_text = re.sub(r':\s*("([^"]*)")',
                      lambda m: f': {colors["string"]}{m.group(1)}{colors["reset"]}',
                      json_text)

    # Booleans and null in keyword style
    json_text = re.sub(r'\b(true|false|null)\b',
                      lambda m: f'{colors["keyword"]}{m.group(1)}{colors["reset"]}',
                      json_text)

    # Numbers in numeric style
    json_text = re.sub(r':\s*(-?\d+(?:\.\d+)?)',
                      lambda m: f': {colors["numeric"]}{m.group(1)}{colors["reset"]}',
                      json_text)

    return json_text

class CustomColorHelpFormatter(argparse.RawDescriptionHelpFormatter):
    """Help formatter that colorizes help text if color is enabled."""
    def __init__(self, prog, colors, **kwargs):
        super().__init__(prog, **kwargs)
        self.colors = colors

    def _format_usage(self, usage, actions, groups, prefix):
        usage_text = super()._format_usage(usage, actions, groups, prefix)
        return f"{self.colors['prompt']}{usage_text}{self.colors['reset']}"

    def _format_action_invocation(self, action):
        text = super()._format_action_invocation(action)
        return f"{self.colors['property']}{text}{self.colors['reset']}"

    def _format_action(self, action):
        # Get the original format
        result = super()._format_action(action)

        # If the action has help, colorize it
        if action.help:
            # Replace the help text part with colorized version
            help_text = action.help
            result = result.replace(help_text, f"{self.colors['string']}{help_text}{self.colors['reset']}")

        return result

###############################################################################
# External tool wrappers
###############################################################################
def run_command(cmd: list[str]) -> str:
    """Run a command and return stdout or empty string on error."""
    try:
        out = subprocess.check_output(cmd, stderr=subprocess.STDOUT)
        return out.decode("utf-8", errors="replace")
    except Exception:
        return ""

def parse_plist(plist_path: str) -> dict:
    """Load a plist from file, or return {} on error."""
    try:
        with open(plist_path, "rb") as f:
            return plistlib.load(f)
    except Exception:
        return {}

def get_architecture(binary_path: str) -> str:
    """Use lipo -archs to get a binary's architecture info."""
    out = run_command(["lipo", "-archs", binary_path]).strip()
    if not out:
        return "N/A"
    if " " in out:
        return "Universal"
    if out == "arm64":
        return "Apple Silicon"
    if out == "x86_64":
        return "Intel [64-bit]"
    if out == "i386":
        return "Intel [32-bit]"
    return out

def get_uuid(binary_path: str) -> str:
    """Use otool -l to find Mach-O UUID."""
    txt = run_command(["otool", "-l", binary_path])
    m = re.search(r'uuid\s+([0-9A-Fa-f-]+)', txt)
    return m.group(1) if m else ""

def parse_dependencies(binary_path: str) -> list[dict]:
    """Use otool -L to parse dependencies, structured by path/current/compat/weak."""
    txt = run_command(["otool", "-L", binary_path])
    lines = txt.splitlines()
    deps = []
    if len(lines) > 1:
        # skip first line (the binary name)
        dep_regex = re.compile(r'^(.*?)\s+\(compatibility\s+version\s+([^,]+),\s+current\s+version\s+([0-9.]+)(,\s*weak)?\)$')
        for line in lines[1:]:
            line = line.strip()
            if not line:
                continue
            match = dep_regex.match(line)
            if match:
                deps.append({
                    "path"                 : match.group(1),
                    "compatibility_version": match.group(2),
                    "current_version"      : match.group(3),
                    "weak"                 : bool(match.group(4))
                })
            else:
                deps.append({"raw": line})
    return deps

def get_sdk_version(binary_path: str) -> str:
    """
    Use otool -l to extract SDK version information.
    Uses a direct grep-like approach to find SDK version.
    """
    txt = run_command(["otool", "-l", binary_path])

    # Find any "sdk X.Y" pattern, which appears on its own line
    sdk_match = re.search(r'^\s*sdk\s+([0-9.]+)', txt, re.MULTILINE)
    if sdk_match:
        return sdk_match.group(1)

    # Fallback to more specific patterns
    build_version_match = re.search(r'cmd LC_BUILD_VERSION.*?sdk\s+([0-9.]+)', txt, re.DOTALL)
    if build_version_match:
        return build_version_match.group(1)

    min_version_match = re.search(r'cmd LC_VERSION_MIN_MACOSX.*?sdk\s+([0-9.]+)', txt, re.DOTALL)
    if min_version_match:
        return min_version_match.group(1)

    # Try any sdk mention as absolute last resort
    any_sdk_match = re.search(r'sdk\s+([0-9.]+)', txt)
    return any_sdk_match.group(1) if any_sdk_match else ""

def get_codesign_info(app_bundle: str) -> list[dict]:
    """
    Run codesign -dv --verbose=4 to get Authority lines and other signing info.
    Returns a list of structured information.
    """
    txt = run_command(["codesign", "-dv", "--verbose=4", app_bundle])
    results = []

    for line in txt.splitlines():
        s = line.strip()

        # Process Authority lines into structured format
        if s.startswith("Authority="):
            parts = s.split("=", 1)
            if len(parts) == 2:
                results.append({
                    "type" : "Authority",
                    "value": parts[1]
                })
        # Add other signature info we might want (TeamID, etc.)
        elif s.startswith("TeamIdentifier="):
            parts = s.split("=", 1)
            if len(parts) == 2:
                results.append({
                    "type" : "TeamIdentifier",
                    "value": parts[1]
                })
        elif s.startswith("Signature="):
            parts = s.split("=", 1)
            if len(parts) == 2:
                results.append({
                    "type" : "Signature",
                    "value": parts[1]
                })

    return results

###############################################################################
# Processin' stuff
###############################################################################
def process_app(app_path: str, args, colors) -> dict | None:
    """Given a .app path, parse info and return dict with metadata."""
    app_path = app_path.rstrip(os.sep)
    if not (os.path.isdir(app_path) and app_path.endswith(".app")):
        return None

    plist_path = os.path.join(app_path, "Contents", "Info.plist")
    if not os.path.isfile(plist_path):
        sys.stderr.write(f"{colors['error']}Warning: {plist_path} not found. Skipping {app_path}.{colors['reset']}\n")
        return None

    info      = parse_plist(plist_path)
    version   = info.get("CFBundleShortVersionString") or info.get("CFBundleVersion", "N/A")
    min_macos = info.get("LSMinimumSystemVersion", "N/A")
    exe_name  = info.get("CFBundleExecutable", "")
    bin_path  = os.path.join(app_path, "Contents", "MacOS", exe_name)
    arch      = get_architecture(bin_path) if os.path.isfile(bin_path) else "N/A"

    meta = {
        "app"          : app_path,
        "version"      : version,
        "minimum_macos": min_macos,
        "architecture" : arch,
    }

    if args.uuid and os.path.isfile(bin_path):
        meta["uuid"] = get_uuid(bin_path)

    if args.deps and os.path.isfile(bin_path):
        meta["dependencies"] = parse_dependencies(bin_path)

    if args.sdk and os.path.isfile(bin_path):
        meta["sdk_version"] = get_sdk_version(bin_path)

    if args.codesign:
        meta["codesign_info"] = get_codesign_info(app_path)

    return meta

def expand_inputs(inputs: list[str]) -> list[str]:
    """Expand directories and patterns into .app bundle paths. Strips trailing slash."""
    results = []
    for inp in inputs:
        inp = inp.rstrip(os.sep)
        if os.path.isdir(inp):
            if inp.endswith(".app"):
                results.append(inp)
            else:
                results.extend(glob.glob(os.path.join(inp, "*.app")))
        else:
            results.extend(glob.glob(inp))
    return list(set(results))

###############################################################################
# entry point
###############################################################################
def main():
    # Step 1: parse just --color from a partial parser, so we can build color scheme
    base_parser = argparse.ArgumentParser(add_help=False)
    base_parser.add_argument("-C", "--color", choices=["auto", "always", "never"], default="auto",
                           help="Colorize output (default: auto).")
    base_parser.add_argument("--color-scheme", type=str, help=argparse.SUPPRESS)  # Hidden option for custom scheme
    known, _ = base_parser.parse_known_args()

    if known.color == "always":
        use_color = True
    elif known.color == "never":
        use_color = False
    else:
        use_color = sys.stdout.isatty()

    # Handle custom color scheme if provided
    custom_scheme = None
    if known.color_scheme:
        try:
            with open(known.color_scheme, 'r') as f:
                custom_scheme = json.load(f)
        except Exception as e:
            sys.stderr.write(f"Warning: Could not load color scheme from {known.color_scheme}: {e}\n")

    colors = get_color_scheme(use_color, custom_scheme)

    # Create main parser with custom formatter for colored help
    # Skip the default help and description, we'll handle it ourselves
    parser = argparse.ArgumentParser(
        usage=f"{colors['prompt']}usage: appDetect.py [options] <app_bundle(s) or pattern(s)>{colors['reset']}",
        formatter_class=lambda prog: CustomColorHelpFormatter(prog, colors=colors),
        add_help=False  # Disable auto-help so we can handle it ourselves
    )
    parser.add_argument("inputs", nargs="*", metavar="app_bundle(s)",
                       help="App bundle(s) or pattern(s)")
                       
    parser.add_argument("-j", "--json", action="store_true",
                       help="Produce JSON output")
                       
    parser.add_argument("-p", "--pretty", action="store_true",
                       help="Pretty print JSON output")
                       
    parser.add_argument("-u", "--uuid", action="store_true",
                       help="Include Mach-O UUID")
                       
    parser.add_argument("-d", "--deps", action="store_true",
                       help="Include dynamic dependencies (structured)")
                       
    parser.add_argument("-s", "--sdk", action="store_true",
                       help="Include SDK version info")
                       
    parser.add_argument("-c", "--codesign", action="store_true",
                       help="Include code signing details")
                       
    parser.add_argument("-C", "--color", choices=["auto", "always", "never"], default="auto",
                       help="Colorize output. Default is auto (enabled if stdout is a tty)")
                       
    parser.add_argument("-h", "--help", action="store_true",
                       help="Show this help message and exit")
                       
    parser.add_argument("--color-scheme", type=str, help="Path to custom color scheme JSON file")

    args = parser.parse_args()

    # If help flag is set, print our custom help message and exit
    if len(sys.argv) == 1 or args.help:
        print(f"{colors['title']}appDetect.py - Extract version, minimum macOS requirement, architecture,{colors['reset']}")
        print(f"{colors['title']}and additional binary metadata from .app bundles. It uses external{colors['reset']}")
        print(f"{colors['title']}tools: otool, lipo, codesign, etc.{colors['reset']}")
        print("")
        print(f"{colors['emphasis']}Usage:{colors['reset']}")
        print(f"  {colors['prompt']}appDetect.py [options] <app_bundle(s) or pattern(s)>{colors['reset']}")
        print("")
        print(f"{colors['emphasis']}Options:{colors['reset']}")
        print(f"  {colors['property']}-j, --json{colors['reset']}         {colors['string']}Produce JSON output.{colors['reset']}")
        print(f"  {colors['property']}-p, --pretty{colors['reset']}       {colors['string']}Pretty print JSON output.{colors['reset']}")
        print(f"  {colors['property']}-u, --uuid{colors['reset']}         {colors['string']}Include Mach-O UUID.{colors['reset']}")
        print(f"  {colors['property']}-d, --deps{colors['reset']}         {colors['string']}Include dynamic library dependencies (structured).{colors['reset']}")
        print(f"  {colors['property']}-s, --sdk{colors['reset']}          {colors['string']}Include SDK version info (LC_VERSION_MIN_MACOSX).{colors['reset']}")
        print(f"  {colors['property']}-c, --codesign{colors['reset']}     {colors['string']}Include code signing details.{colors['reset']}")
        print(f"  {colors['property']}-C, --color {colors['heading']}{{auto,always,never}}{colors['reset']}")
        print(f"                     {colors['string']}Colorize output. Default is auto (enabled if stdout is a tty).{colors['reset']}")
        print(f"  {colors['property']}-h, --help{colors['reset']}         {colors['string']}Show this help message and exit.{colors['reset']}")
        print(f"  {colors['property']}--color-scheme{colors['reset']}     {colors['string']}Path to custom color scheme JSON file.{colors['reset']}")
        print("")
        print(f"{colors['emphasis']}Examples:{colors['reset']}")
        print(f"  {colors['prompt']}appDetect.py /Applications/Safari.app{colors['reset']}")
        print(f"  {colors['prompt']}appDetect.py /Applications/*.app{colors['reset']}")
        print(f"  {colors['prompt']}appDetect.py -p -u -d -s -c -C always /Applications /path/to/MyApp.app{colors['reset']}")
        sys.exit(0)

    # Check if we have inputs
    if not args.inputs:
        parser.print_usage()
        sys.stderr.write(f"{colors['error']}Error: App bundle(s) or pattern(s) required{colors['reset']}\n")
        sys.exit(1)

    # Expand patterns
    apps = expand_inputs(args.inputs)
    if not apps:
        sys.stderr.write(f"{colors['error']}No app bundles found.{colors['reset']}\n")
        sys.exit(1)

    # Gather metadata
    results = []
    for app in apps:
        m = process_app(app, args, colors)
        if m:
            results.append(m)

    # Output
    if args.json:
        # JSON mode
        out_str = json.dumps(results, indent=4 if args.pretty else None)
        if use_color:
            out_str = colorize_json(out_str, colors)
        print(out_str)
    else:
        # Plain text mode
        for r in results:
            print(f"{colors['emphasis']}{colors['title']}App:{colors['reset']} {r.get('app')}")
            print(f"  {colors['property']}Version:{colors['reset']} {colors['version']}{r.get('version')}{colors['reset']}")
            print(f"  {colors['property']}Minimum macOS:{colors['reset']} {colors['version']}{r.get('minimum_macos')}{colors['reset']}")
            print(f"  {colors['property']}Architecture:{colors['reset']} {colors['arch']}{r.get('architecture')}{colors['reset']}")

            if args.uuid:
                print(f"  {colors['property']}UUID:{colors['reset']} {colors['string']}{r.get('uuid', '')}{colors['reset']}")

            if args.deps:
                print(f"  {colors['property']}Dependencies:{colors['reset']}")
                for dep in r.get("dependencies", []):
                    if "raw" in dep:
                        print(f"    {colors['dependency']}{dep['raw']}{colors['reset']}")
                    else:
                        w = dep.get("weak", False)
                        weak_str = f"{colors['success']}Yes{colors['reset']}" if w else f"{colors['error']}No{colors['reset']}"
                        print(f"    {colors['path']}{dep['path']}{colors['reset']} (compat: {colors['version']}{dep['compatibility_version']}{colors['reset']}, current: {colors['version']}{dep['current_version']}{colors['reset']}, weak: {weak_str})")

            if args.sdk:
                sdk_v = r.get("sdk_version", "")
                print(f"  {colors['property']}SDK Version:{colors['reset']} {colors['version']}{sdk_v}{colors['reset']}")

            if args.codesign:
                print(f"  {colors['property']}Code Signing Info:{colors['reset']}")
                info_items = r.get("codesign_info", [])
                if not info_items:
                    print(f"    {colors['error']}None{colors['reset']}")
                else:
                    for item in info_items:
                        if item.get("type") == "Authority":
                            print(f"    {colors['property']}Authority={colors['reset']}{colors['certificate']}{item.get('value')}{colors['reset']}")
                        elif item.get("type") == "TeamIdentifier":
                            print(f"    {colors['property']}TeamIdentifier={colors['reset']}{colors['certificate']}{item.get('value')}{colors['reset']}")
                        elif item.get("type") == "Signature":
                            print(f"    {colors['property']}Signature={colors['reset']}{colors['certificate']}{item.get('value')}{colors['reset']}")
            print()

if __name__ == "__main__":
    main()
