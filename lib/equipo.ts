// Operadores del equipo con su zona (planilla de Dario, 22-oct-2026). El
// código "operador" es el que figura en la columna OPE de las planillas y el
// que vincula cada cuenta con sus casos — no cambiarlo sin migrar los casos.
export const OPERADORES_EQUIPO = [
  { operador: "CARLOS", username: "carlos", nombre: "Carlos Perez", zona: "Zona Oeste y Norte CABA" },
  { operador: "JULIAN", username: "julian", nombre: "Julian Caradios", zona: "Zona Sur Lomas-Ezeiza" },
  { operador: "NACHO", username: "nacho", nombre: "Ignacio Des", zona: "Zona Sur Avellaneda Berazategui - CABA Sur" },
  { operador: "MANUEL", username: "manuel", nombre: "Manuel Choque", zona: "Mix Z Sur Lomas, Quilmes, Avellaneda - CABA Sur" },
] as const;
