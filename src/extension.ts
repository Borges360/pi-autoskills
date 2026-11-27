import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { register, toolResult } from "./common/runtime.js";
import { createService, AutoSkills, autoSkillsMenuGroups } from "./skills.js";
import { registerInteiroPiThemes } from "./vendor/inteiro-terminal/pi.js";
export default function (pi: ExtensionAPI) {
  // Makes the design-system Pi themes available in /settings: no separate install, never selects one.
  registerInteiroPiThemes(pi);
  const runtime = register(pi, "pi-autoskills", "autoskills", createService, [], {
    menuGroups: autoSkillsMenuGroups,
  });
  pi.registerTool({
    name: "autoskills_select",
    label: "Select skills",
    description: "Select a minimal relevant set of audited installed skills.",
    parameters: Type.Object({
      text: Type.String(),
      paths: Type.Array(Type.String()),
      stack: Type.Array(Type.String()),
    }),
    execute: async (_id, input, _signal, _update, ctx) => {
      const h = await runtime.get(ctx);
      return h.serial(async () =>
        toolResult(await (h.service as AutoSkills).select(input)),
      );
    },
  });
}
