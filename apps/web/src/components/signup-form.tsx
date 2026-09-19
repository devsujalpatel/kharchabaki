"use client";

import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import Link from "next/link";
import { useRouter } from "next/navigation";

const signupSchema = z
  .object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    email: z.email("Enter a valid email address"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type SignupFormValues = z.infer<typeof signupSchema>;

export function SignupForm({ ...props }: React.ComponentProps<typeof Card>) {
  const form = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });
  const router = useRouter();
  const handleSubmit = async (values: SignupFormValues) => {
    try {
      const { error } = await authClient.signUp.email({
        name: values.name,
        email: values.email,
        password: values.password,
      });

      if (error) {
        toast.error(error.message);
        return;
      }

      toast.success("Account created successfully");
      router.push("/auth/signin");
    } catch {
      toast.error("Something went wrong. Please try again.");
    }
  };

  return (
    <Card {...props}>
      <CardHeader>
        <CardTitle>Create an account</CardTitle>
        <CardDescription>
          Enter your information below to create your account
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={form.handleSubmit(handleSubmit)}>
          <FieldGroup>
            {/* Name */}
            <Field>
              <FieldLabel htmlFor="name">Full Name</FieldLabel>

              <Input
                id="name"
                type="text"
                placeholder="John Doe"
                {...form.register("name")}
                disabled={form.formState.isSubmitting}
              />

              {form.formState.errors.name && (
                <FieldDescription className="text-destructive">
                  {form.formState.errors.name.message}
                </FieldDescription>
              )}
            </Field>

            {/* Email */}
            <Field>
              <FieldLabel htmlFor="email">Email</FieldLabel>

              <Input
                id="email"
                type="email"
                placeholder="m@example.com"
                {...form.register("email")}
                disabled={form.formState.isSubmitting}
              />

              {form.formState.errors.email ? (
                <FieldDescription className="text-destructive">
                  {form.formState.errors.email.message}
                </FieldDescription>
              ) : (
                <FieldDescription>
                  We&apos;ll use this to contact you. We will not share your
                  email with anyone else.
                </FieldDescription>
              )}
            </Field>

            {/* Password */}
            <Field>
              <FieldLabel htmlFor="password">Password</FieldLabel>

              <Input
                id="password"
                type="password"
                {...form.register("password")}
                disabled={form.formState.isSubmitting}
              />

              {form.formState.errors.password ? (
                <FieldDescription className="text-destructive">
                  {form.formState.errors.password.message}
                </FieldDescription>
              ) : (
                <FieldDescription>
                  Must be at least 8 characters long.
                </FieldDescription>
              )}
            </Field>

            {/* Confirm Password */}
            <Field>
              <FieldLabel htmlFor="confirm-password">
                Confirm Password
              </FieldLabel>

              <Input
                id="confirm-password"
                type="password"
                {...form.register("confirmPassword")}
                disabled={form.formState.isSubmitting}
              />

              {form.formState.errors.confirmPassword ? (
                <FieldDescription className="text-destructive">
                  {form.formState.errors.confirmPassword.message}
                </FieldDescription>
              ) : (
                <FieldDescription>
                  Please confirm your password.
                </FieldDescription>
              )}
            </Field>

            <FieldGroup>
              <Field>
                <Button type="submit" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting
                    ? "Creating account..."
                    : "Create Account"}
                </Button>

                <FieldSeparator className="my-2">
                  Or continue with
                </FieldSeparator>
                <Button
                  variant="outline"
                  type="button"
                  onClick={() =>
                    authClient.signIn.social({
                      provider: "google",
                      callbackURL: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`,
                    })
                  }
                >
                  Sign up with Google
                </Button>

                <FieldDescription className="px-6 text-center">
                  Already have an account?{" "}
                  <Link
                    href="/auth/signin"
                    className="underline underline-offset-4"
                  >
                    Sign in
                  </Link>
                </FieldDescription>
              </Field>
            </FieldGroup>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
