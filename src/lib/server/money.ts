import { Prisma } from "@prisma/client";

export type Dec = Prisma.Decimal;
export const D = (v: Prisma.Decimal.Value): Dec => new Prisma.Decimal(v);
export const down2 = (d: Dec) => d.toDecimalPlaces(2, Prisma.Decimal.ROUND_DOWN);   // payouts round down, in the house's favour
export const fixed = (d: Dec | null | undefined) => (d ? d.toFixed(2) : "0.00");
export const toPesewas = (d: Dec) => d.mul(100).toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP).toNumber();
