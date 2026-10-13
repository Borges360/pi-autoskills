#!/usr/bin/env node
import { cli } from "./common/cli.js";
import { createService } from "./skills.js";
await cli("pi-autoskills", createService);
