import { Ditto } from "../ditto/Instance";
import { CMD } from "../defines/CMD";
import { CMDS } from "./CMDS";

const help = `Usage: HELP [command]

List every command / show one command's full help
列出所有可用命令；给了命令名就显示该命令的完整帮助`;

const COLUMNS = 4;
const COLUMN_WIDTH = 18;

CMDS.register(CMD.HELP, help, (ctx) => {
  const all = CMDS.list();
  const which = ctx.str(1);
  if (which) {
    const hit = all.find((it) => it.key === which.toLowerCase());
    if (!hit) return Ditto.warn(`HELP: unknown command "${which}"（用 \`help\` 看全部）`);
    return Ditto.Log(hit.help);
  }

  const rows: string[] = [];
  let row = '';
  let inRow = 0;
  for (const it of all) {
    row += it.key.toUpperCase().padEnd(COLUMN_WIDTH);
    if (++inRow === COLUMNS) {
      rows.push(row);
      row = '';
      inRow = 0;
    }
  }
  if (row) rows.push(row);

  Ditto.Log(
    [
      `${all.length} commands:`,
      ...rows.map((r) => `  ${r}`),
      '（`help <command>` 看某条命令的完整帮助）',
    ].join('\n'),
  );
});