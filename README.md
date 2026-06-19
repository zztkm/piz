# piz

`piz` is a Pi package that bundles small Pi Coding Agent extensions in one repository.

## Extensions

This package currently includes:

- `pi-forge`: `/forge` command for asking the agent how to maintain `AGENTS.md` and Agent Skills from the current session.
- `pi-sub-agent-z`: `sub_agent` tool plus `/sub-agent` and `/subagent` commands for read-only exploration, review, and planning sub agents.

## Installation

Install from git:

```sh
pi install git:github.com/zztkm/piz
```

Reload Pi if the current session does not pick up the package automatically:

```text
/reload
```

For local development:

```sh
pi -e ./extensions
```

## Usage

Run Pi Forge:

```text
/forge
/forge agents
/forge skills
/forge --include-session
```

Run a sub agent explicitly:

```text
/sub-agent explore Find the files and flow related to authentication.
/sub-agent review Review the planned authentication changes for likely bugs.
/sub-agent plan Plan a small implementation for adding request caching.
```

The main agent can also call the `sub_agent` tool automatically when it needs bounded read-only exploration, review, or planning.

## Package Layout

`piz` follows the conventional Pi package layout:

```text
extensions/
├── pi-forge/
│   └── index.ts
└── pi-sub-agent-z/
    └── index.ts
```

The package manifest exposes `./extensions` through `pi.extensions`, so one git package can load all extension directories.

## Development

```sh
npm install
npm run check
```

Pi loads TypeScript extensions directly, so a build step is not required for installation.
