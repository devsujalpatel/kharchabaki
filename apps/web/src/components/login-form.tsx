"use client";

import { cn } from "cn";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

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
import { toast } from "sonner";
import Link from "next/link";
import { useRouter } from "next/navigation";

const loginSchema = z.object({
  email: z.email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });


  const handleSubmit = async (values: LoginFormValues) => {
    try {
      const { error } = await authClient.signIn.email({
        email: values.email,
        password: values.password,
      });

      if (error) {
        toast.error(error.message);
        return;
      }

      toast.success("Login successful");

      window.location.href = "/dashboard";
    } catch {
      toast.error("Something went wrong. Please try again.");
    }
  };

  return (
    <div className={cn("flex flex-col gap-6 min-w-90", className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle>Login to your account</CardTitle>
          <CardDescription>
            Enter your email below to login to your account
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={form.handleSubmit(handleSubmit)}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="email">Email</FieldLabel>

                <Input
                  id="email"
                  type="email"
                  placeholder="email@example.com"
                  {...form.register("email")}
                  disabled={form.formState.isSubmitting}
                />

                {form.formState.errors.email && (
                  <FieldDescription className="text-destructive">
                    {form.formState.errors.email.message}
                  </FieldDescription>
                )}
              </Field>

              <Field>
                <div className="flex items-center">
                  <FieldLabel htmlFor="password">Password</FieldLabel>

                  <a
                    href="#"
                    className="ml-auto inline-block text-sm underline-offset-4 hover:underline"
                  >
                    Forgot your password?
                  </a>
                </div>

                <Input
                  id="password"
                  type="password"
                  {...form.register("password")}
                  disabled={form.formState.isSubmitting}
                />

                {form.formState.errors.password && (
                  <FieldDescription className="text-destructive">
                    {form.formState.errors.password.message}
                  </FieldDescription>
                )}
              </Field>

              <Field>
                <Button type="submit" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting ? "Logging in..." : "Login"}
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
                  disabled
                >
                  Login with Google
                </Button>

                <FieldDescription className="text-center">
                  Don&apos;t have an account?{" "}
                  <Link
                    href="/auth/signup"
                    className="underline underline-offset-4"
                  >
                    Sign up
                  </Link>
                </FieldDescription>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
