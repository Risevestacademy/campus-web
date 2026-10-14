// z.toZod compares types exactly, and an intersection such as
// Pick<A, "x"> & { y: B } never equals the flat object a schema infers.
export type Simplify<T> = { [Key in keyof T]: T[Key] };
