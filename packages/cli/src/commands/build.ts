import ts from "typescript";
import { performance } from "node:perf_hooks";
import { ResolvedConfig } from "../config/config.contract";

const color = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  green: "\x1b[32m",
  cyan: "\x1b[36m",
};

function title(msg: string) {
  console.log(`${color.cyan}${color.bold}TRINACRIA${color.reset} ${msg}`);
}

function success(msg: string) {
  console.log(`${color.green}✔ ${msg}${color.reset}`);
}

function error(msg: string) {
  console.error(`${color.red}✖ ${msg}${color.reset}`);
}

function warning(msg: string) {
  console.warn(`${color.yellow}⚠ ${msg}${color.reset}`);
}

export async function build(config: ResolvedConfig) {
  title("Building application...\n");

  const startTime = performance.now();

  const configPath = ts.findConfigFile(
    process.cwd(),
    ts.sys.fileExists,
    "tsconfig.json",
  );

  if (!configPath) {
    error("Could not find tsconfig.json");
    process.exit(1);
  }

  const configFile = ts.readConfigFile(configPath, ts.sys.readFile);

  const parsed = ts.parseJsonConfigFileContent(
    configFile.config,
    ts.sys,
    process.cwd(),
    {
      outDir: config.outDir,
    },
  );

  const program = ts.createProgram(parsed.fileNames, parsed.options);

  // 📦 Mostra file compilati (non declaration)
  const sourceFiles = program
    .getSourceFiles()
    .filter((f) => !f.isDeclarationFile);

  console.log(
    `${color.dim}Compiling ${sourceFiles.length} files...${color.reset}\n`,
  );

  const emitResult = program.emit();

  const diagnostics = ts
    .getPreEmitDiagnostics(program)
    .concat(emitResult.diagnostics);

  let errorCount = 0;
  let warningCount = 0;

  diagnostics.forEach((diagnostic) => {
    const message = ts.flattenDiagnosticMessageText(
      diagnostic.messageText,
      "\n",
    );

    if (diagnostic.category === ts.DiagnosticCategory.Error) {
      errorCount++;
    } else if (diagnostic.category === ts.DiagnosticCategory.Warning) {
      warningCount++;
    }

    if (diagnostic.file && diagnostic.start !== undefined) {
      const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(
        diagnostic.start,
      );

      const location = `${diagnostic.file.fileName}:${line + 1}:${
        character + 1
      }`;

      if (diagnostic.category === ts.DiagnosticCategory.Error) {
        error(`${location} - ${message}`);
      } else {
        warning(`${location} - ${message}`);
      }
    } else {
      if (diagnostic.category === ts.DiagnosticCategory.Error) {
        error(message);
      } else {
        warning(message);
      }
    }
  });

  const duration = (performance.now() - startTime).toFixed(2);

  console.log(""); // spacing

  if (emitResult.emitSkipped || errorCount > 0) {
    error(
      `Build failed with ${errorCount} error(s) and ${warningCount} warning(s)`,
    );
    process.exit(1);
  }

  success(`Build completed in ${duration}ms`);

  console.log(`${color.dim}Output directory:${color.reset} ${config.outDir}`);

  console.log(
    `${color.dim}Files compiled:${color.reset} ${sourceFiles.length}\n`,
  );
}
