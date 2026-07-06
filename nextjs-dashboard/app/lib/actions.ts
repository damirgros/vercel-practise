"use server";

import { z } from "zod";
import postgres from "postgres";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const sql = postgres(process.env.POSTGRES_URL!, { ssl: "require" });

const FormSchema = z.object({
  id: z.string(),
  customerId: z.string(),
  amount: z.coerce.number(),
  status: z.enum(["pending", "paid"]),
  date: z.string(),
});

const CreateInvoice = FormSchema.omit({ id: true, date: true });
const UpdateInvoice = FormSchema.omit({ id: true, date: true });

export async function createInvoice(data: FormData) {
  const rawFormData = Object.fromEntries(data.entries());
  const validatedData = CreateInvoice.parse(rawFormData);
  const amountInCents = validatedData.amount * 100;
  const date = new Date().toISOString().split("T")[0];

  await sql`
        INSERT INTO invoices (customer_id, amount, status, date)
        VALUES (${validatedData.customerId}, ${amountInCents}, ${validatedData.status}, ${date})
    `;

  revalidatePath("/dashboard/invoices");
  redirect("/dashboard/invoices");
}

export async function updateInvoice(id: string, data: FormData) {
  const rawFormData = Object.fromEntries(data.entries());
  const validatedData = UpdateInvoice.parse(rawFormData);
  const amountInCents = validatedData.amount * 100;

  await sql`
        UPDATE invoices
        SET customer_id = ${validatedData.customerId},
            amount = ${amountInCents},
            status = ${validatedData.status}
        WHERE id = ${id}
    `;

  revalidatePath("/dashboard/invoices");
  redirect("/dashboard/invoices");
}

export async function deleteInvoice(id: string) {
  await sql`
        DELETE FROM invoices
        WHERE id = ${id}
    `;

  revalidatePath("/dashboard/invoices");
}
