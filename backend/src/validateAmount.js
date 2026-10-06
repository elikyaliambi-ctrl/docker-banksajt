// Ett giltigt belopp (för insättning, och senare uttag) ska vara ett
// ändligt tal som är större än noll. Avvisar NaN, Infinity, 0, negativa
// tal och allt som inte är av typen number.
export function validateAmount(amount) {
  return typeof amount === "number" && Number.isFinite(amount) && amount > 0;
}
