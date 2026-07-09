"use server";

import { z } from "zod";
import postgres from "postgres";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { signIn } from "@/auth";
const sql = postgres(process.env.POSTGRES_URL!, { ssl: "require" });

const FormSchema = z.object({
  id: z.string(),
  customerId: z.string({
    invalid_type_error: "Customer ID must be a string",
  }),
  amount: z.coerce.number().gt(0, { message: "Amount must be greater than 0" }),
  status: z.enum(["pending", "paid"], {
    invalid_type_error: "Status must be either 'pending' or 'paid'",
  }),
  date: z.string(),
});

export type State = {
  errors?: {
    customerId?: string[];
    amount?: string[];
    status?: string[];
  };
  message?: string | null;
};

const CreateInvoice = FormSchema.omit({ id: true, date: true });
const UpdateInvoice = FormSchema.omit({ id: true, date: true });

export async function createInvoice(prevState: State, formData: FormData) {
  const validatedData = CreateInvoice.safeParse({
    customerId: formData.get("customerId"),
    amount: formData.get("amount"),
    status: formData.get("status"),
  });
  const amountInCents = validatedData.data?.amount * 100;
  const date = new Date().toISOString().split("T")[0];

  if (!validatedData.success) {
    return {
      errors: validatedData.error.flatten().fieldErrors,
      message: "Failed to create invoice.",
    };
  }
  try {
    await sql`
        INSERT INTO invoices (customer_id, amount, status, date)
        VALUES (${validatedData.data.customerId}, ${amountInCents}, ${validatedData.data.status}, ${date})
    `;
  } catch (error) {
    return {
      message: "Failed to create invoice.",
    };
  }

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

export async function authenticate(
  prevState: string | undefined,
  formData: FormData,
) {
  try {
    await signIn("credentials", formData);
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case "CredentialsSignin":
          return "Invalid credentials.";
        default:
          return "Something went wrong.";
      }
    }
    throw error;
  }
}
