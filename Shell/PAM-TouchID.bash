#!/usr/bin/env bash
set -e

# Color definitions (only if output is a terminal)
if [ -t 1 ]; then
  RED='\033[0;31m'
  GREEN='\033[0;32m'
  YELLOW='\033[0;33m'
  PURPLE='\033[0;34m'
  CYAN='\033[0;36m'
  NC='\033[0m'
else
  RED=''
  GREEN=''
  YELLOW=''
  PURPLE=''
  CYAN=''
  NC=''
fi

# Default log level: 2 = verbose, 1 = normal, 0 = silent (errors only)
LOG_LEVEL=1

# usage: Prints the help/usage information.
usage() {
  echo -e "${YELLOW}Usage:${NC}"
  echo -e "  ${CYAN}$0 ${GREEN}add    ${YELLOW}<file> ${PURPLE}\"<line>\"${NC}      - Add the specified line to the PAM file."
  echo -e "  ${CYAN}$0 ${GREEN}remove ${YELLOW}<file> ${PURPLE}\"<line>\"${NC}      - Remove the specified line from the PAM file."
  echo -e "  ${CYAN}$0 ${GREEN}toggle ${YELLOW}<file> ${PURPLE}\"<line>\"${NC}      - Toggle the specified line in the PAM file."
  echo -e "  ${CYAN}$0 ${GREEN}touchid ${NC}[${YELLOW}add${NC}|${RED}remove${NC}|${PURPLE}toggle${NC}] - Manage TouchID support for ${PURPLE}/etc/pam.d/sudo${NC} and ${PURPLE}/etc/pam.d/su${PURPLE}."
  echo -e ""
  echo -e "${YELLOW}Options:${NC}"
  echo -e "  ${CYAN}-v${NC}, ${PURPLE}--verbose${NC}           Enable verbose output."
  echo -e "  ${CYAN}-q${NC}, ${PURPLE}--quiet${NC}, ${GREEN}--silent${NC}   Suppress output except errors."
  echo -e "  ${CYAN}-h${NC}, ${PURPLE}--help${NC}              Display this help message."
  echo -e ""
  echo -e "If no command is provided, the script defaults to adding TouchID support."
}

# Process command-line options.
while [[ "$1" == -* ]]; do
    case "$1" in
        -v|--verbose)
          LOG_LEVEL=2
          shift
          ;;

        -q|--quiet|--silent)
          LOG_LEVEL=0
          shift
          ;;

        -h|--help)
          usage
          exit 0
          ;;

        *)
          echo -e "${RED}[ERROR] Unknown option: $1${NC}" >&2
          exit 1
          ;;
    esac
done

# Logging functions with color.
log_verbose()
{   if [ "$LOG_LEVEL" -ge 2 ]; then
        echo -e "${PURPLE}[VERBOSE]${NC} $*"
    fi
}

log_info()
{   if [ "$LOG_LEVEL" -ge 1 ]; then
        echo -e "${GREEN}[INFO]${NC} $*"
    fi
}

log_error()
{
  echo -e "${RED}[ERROR]${NC} $*" >&2
}

# Elevate if not running as root.
if [ "$EUID" -ne 0 ]; then
  if sudo -n true 2>/dev/null; then
    log_info "Sudo credentials detected (cached). Elevating without prompt..."
    exec sudo -n "$0" "$@"
  else
    log_info "Not running as root. Elevating..."
    exec sudo "$0" "$@"
  fi
fi

# pattern_from_line: Given a canonical line, produce a regex pattern that
# matches it regardless of spacing.
pattern_from_line()
{   local line="$1"
    # Trim leading/trailing whitespace.
    local trimmed
    trimmed=$(echo "$line" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
    # Escape forward slashes.
    local escaped
    escaped=$(echo "$trimmed" | sed 's/\//\\\//g')
    # Replace one or more whitespace characters with [[:space:]]+
    local pattern
    pattern=$(echo "$escaped" | sed -E 's/[[:space:]]+/[[:space:]]+/g')
    # Add anchors (allowing optional surrounding whitespace)
    echo "^[[:space:]]*${pattern}[[:space:]]*$"
}

# backup_file: Creates a timestamped backup of a file.
backup_file() {
  local file="$1"
  cp "$file" "$file.bak_$(date +%Y%m%d%H%M%S)"
  log_verbose "Backup created for $file"
}

# add_line: Adds a given canonical line to a PAM file if not present.
# Instead of prepending, if the first line is a comment, we insert the line after it.
add_line()
{   local file="$1"
    local line="$2"
    local pattern
    pattern=$(pattern_from_line "$line")
    if grep -Eq "$pattern" "$file"; then
        log_info "No change: The specified line is already present in $file."
        return 0
    
    else
        backup_file "$file"
        if head -n 1 "$file" | grep -q '^#'; then
            # Insert the line after the first line.
            sed -i '' "1a\\
                $line
                " "$file"
        
        else
            # Prepend if no comment exists.
            sed -i '' "1s/^/$line\n/" "$file"
        fi

        log_info "Line added to $file."
    fi
}

# remove_line: Removes a given canonical line from a PAM file if it exists,
# matching regardless of extra/missing whitespace.
remove_line()
{   local file="$1"
    local line="$2"
    local pattern
    pattern=$(pattern_from_line "$line")
    if grep -Eq "$pattern" "$file"; then
        backup_file "$file"
        # Using '|' as delimiter for clarity.
        sed -E -i '' "\|$pattern|d" "$file"
        log_info "Line removed from $file."
    
    else
        log_info "No change: The specified line was not found in $file."
        return 0
    fi
}

# toggle_line: Toggles the presence of a given canonical line in a PAM file.
toggle_line()
{   local file="$1"
    local line="$2"
    local pattern
    pattern=$(pattern_from_line "$line")
    if grep -Eq "$pattern" "$file"; then
        log_info "Toggling: Line exists in $file; removing it."
        remove_line "$file" "$line"
    
    else
        log_info "Toggling: Line not found in $file; adding it."
        add_line "$file" "$line"
    fi
}

# Command parsing.
if [ $# -eq 0 ]; then
    mode="touchid"
    action="add"

elif [ "$1" = "add" ]; then
    if [ $# -ne 3 ]; then usage; exit 1; fi
        add_line "$2" "$3"
        exit 0

elif [ "$1" = "remove" ]; then
    if [ $# -ne 3 ]; then usage; exit 1; fi
        remove_line "$2" "$3"
        exit 0

elif [ "$1" = "toggle" ]; then
    if [ $# -ne 3 ]; then usage; exit 1; fi
        toggle_line "$2" "$3"
        exit 0


elif [ "$1" = "touchid" ]; then
    mode="touchid"
    if [ $# -eq 2 ]; then
        action="$2"

    else
        action="add"

    fi

else
    usage
    exit 1
fi

# Default PAM files and canonical TouchID line.
pam_files=( "/etc/pam.d/sudo" "/etc/pam.d/su" )
touchid_line="auth       sufficient     pam_tid.so"

if [ "$mode" = "touchid" ]; then
    for file in "${pam_files[@]}"; do
        if [ -f "$file" ]; then
            case "$action" in
                add)
                    log_info "Adding TouchID support to $file..."
                    add_line "$file" "$touchid_line"
                    ;;

                remove)
                    log_info "Removing TouchID support from $file..."
                    remove_line "$file" "$touchid_line"
                    ;;

                toggle)
                    log_info "Toggling TouchID support in $file..."
                    toggle_line "$file" "$touchid_line"
                    ;;
          
                *)
                    log_error "Unknown action: $action"
                    usage
                    exit 1
                    ;;
            esac
        else
            log_verbose "PAM file $file not found; skipping."
        fi
    done
fi

log_info "Operation completed."
