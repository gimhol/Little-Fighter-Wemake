interface Result { a: number, b: number, c: number, d: number }
const result: Result = { a: 0, b: 0, c: 0, d: 0 }
export function normalize_plane(a: number, b: number, c: number, d: number): Readonly<Result> {
  if (a < 0 || (a === 0 && b < 0) || (a === 0 && b === 0 && c < 0)) {
    a = -a; b = -b; c = -c; d = -d;
  }
  result.a = a;
  result.b = b;
  result.c = c;
  result.d = d;
  return result;
}


