import { inspect } from "util";

export async function runScript<T>(f: () => Promise<T>): Promise<never> {
  try {
    const result = await f();
    if (result !== undefined) console.log(inspect(result, false, null, true));
    console.log("DONE");
    process.exit(0);
  } catch (error) {
    console.error("ERROR");
    console.error(error instanceof Error ? error : inspect(error, false, null, true));
    const status = error && (error as { status?: unknown }).status;
    process.exit(typeof status === "number" ? status : 1);
  }
}
