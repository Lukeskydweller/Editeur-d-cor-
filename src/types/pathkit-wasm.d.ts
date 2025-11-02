declare module "pathkit-wasm" {
  export interface PathKitPath {
    moveTo(x: number, y: number): void;
    lineTo(x: number, y: number): void;
    close(): void;
    delete(): void;
  }

  export interface PathKitModule {
    NewPath(): PathKitPath;
    MakeFromOp(a: PathKitPath, b: PathKitPath, op: number): PathKitPath | null;
    PathOp: {
      UNION: number;
      INTERSECT: number;
      DIFFERENCE: number;
      XOR: number;
    };
  }

  export default function PathKitInit(): Promise<PathKitModule>;
}
