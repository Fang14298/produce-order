#!/usr/bin/env bash
# skills.sh - Script for pulling and managing skills from skills.sh ecosystem
# and syncing with antigravity-cli

SUPERPOWERS_SKILLS="C:/Users/fang0/.gemini/config/plugins/superpowers/skills"
CLI_SKILLS_DIR="$HOME/.gemini/antigravity-cli/skills"
CLI_SKILLS_JSON="$CLI_SKILLS_DIR/skills.json"

echo "=== Agent Skills Manager (skills.sh) ==="
echo "Superpowers directory: $SUPERPOWERS_SKILLS"
echo "Antigravity CLI configuration: $CLI_SKILLS_JSON"
echo ""

# Ensure skills.json exists
mkdir -p "$CLI_SKILLS_DIR"
cat << 'EOF' > "$CLI_SKILLS_JSON"
{
  "entries": [
    {
      "path": "C:/Users/fang0/.gemini/config/plugins/superpowers/skills"
    },
    {
      "path": "C:/Users/fang0/.agents/skills"
    }
  ]
}
EOF
echo "[✓] Updated $CLI_SKILLS_JSON to include superpowers and global skills."

# If arguments provided, pass them to npx skills CLI
if [ "$#" -gt 0 ]; then
    echo "[→] Executing: npx skills $@"
    npx -y skills "$@"
else
    echo "[i] Current Installed Global Skills:"
    npx -y skills ls -g
    echo ""
    echo "Usage examples:"
    echo "  ./skills.sh add vercel-labs/agent-skills"
    echo "  ./skills.sh find <keyword>"
    echo "  ./skills.sh ls -g"
fi
