// El valor interno del rol sigue siendo "vendedor" en la base (no se toca para
// no romper cuentas ya creadas ni los checks de acceso existentes), pero de
// cara al usuario el nombre correcto del puesto es "operador".
export function etiquetaRol(rol: string): string {
  return rol === "admin" ? "Admin" : "Operador";
}
