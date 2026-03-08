import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@shared/context/AuthContext";
import { loginSchema, type LoginFormValues } from "@features/Auth/schemas/authSchemas";
import { Button } from "@/shared/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import {
    Field,
    FieldDescription,
    FieldError,
    FieldGroup,
    FieldLabel,
} from "@/shared/components/ui/field";
import { ThemeToggle } from "@/shared/components/ui/theme-toggle";

export default function LoginPage() {
    const { login, isAuthenticated } = useAuth();
    const navigate = useNavigate();
    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
    } = useForm<LoginFormValues>({
        resolver: zodResolver(loginSchema),
        defaultValues: {
            email: "",
            password: "",
        },
    });

    // Redirect if already authenticated
    useEffect(() => {
        if (isAuthenticated) {
            // Check for pending invitation
            const pendingInvitationId = sessionStorage.getItem("pendingInvitationId");
            console.log("LoginPage: isAuthenticated, pendingInvitationId:", pendingInvitationId);
            if (pendingInvitationId) {
                sessionStorage.removeItem("pendingInvitationId");
                console.log("LoginPage: Redirecting to accept-invitation:", pendingInvitationId);
                navigate(`/accept-invitation/${pendingInvitationId}`, { replace: true });
            } else {
                console.log("LoginPage: No pending invitation, redirecting to dashboard");
                navigate("/", { replace: true });
            }
        }
    }, [isAuthenticated, navigate]);

    const onSubmit = async (values: LoginFormValues) => {
        try {
            await login(values);
            const pendingInvitationId = sessionStorage.getItem("pendingInvitationId");
            if (pendingInvitationId) {
                sessionStorage.removeItem("pendingInvitationId");
                navigate(`/accept-invitation/${pendingInvitationId}`, { replace: true });
                return;
            }

            navigate("/", { replace: true });
        } catch (error) {
            const message = error instanceof Error ? error.message : "Login failed";
            toast.error(message);
        }
    };

    return (
        <div className="flex min-h-svh flex-col items-center justify-center bg-muted p-6 md:p-10">
            <div className="absolute top-4 right-4">
                <ThemeToggle />
            </div>
            <div className="w-full max-w-sm">
                <div className="flex flex-col gap-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Login to your account</CardTitle>
                            <CardDescription>
                                Enter your email below to login to your account
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleSubmit(onSubmit)} noValidate>
                                <FieldGroup>
                                    <Field data-invalid={Boolean(errors.email)}>
                                        <FieldLabel htmlFor="email">Email</FieldLabel>
                                        <Input
                                            id="email"
                                            type="email"
                                            placeholder="m@example.com"
                                            aria-invalid={Boolean(errors.email)}
                                            {...register("email")}
                                        />
                                        <FieldError errors={[errors.email]} />
                                    </Field>
                                    <Field data-invalid={Boolean(errors.password)}>
                                        <div className="flex items-center">
                                            <FieldLabel htmlFor="password">Password</FieldLabel>
                                            <Link
                                                to="/forgot-password"
                                                className="ml-auto inline-block text-sm underline-offset-4 hover:underline"
                                            >
                                                Forgot your password?
                                            </Link>
                                        </div>
                                        <Input
                                            id="password"
                                            type="password"
                                            aria-invalid={Boolean(errors.password)}
                                            {...register("password")}
                                        />
                                        <FieldError errors={[errors.password]} />
                                    </Field>
                                    <Field>
                                        <Button type="submit" disabled={isSubmitting}>
                                            {isSubmitting ? "Logging in..." : "Login"}
                                        </Button>
                                        <Button variant="outline" type="button">
                                            Login with Google
                                        </Button>
                                        <FieldDescription className="text-center">
                                            Don&apos;t have an account?{" "}
                                            <Link to="/signup" className="underline underline-offset-4">
                                                Sign up
                                            </Link>
                                        </FieldDescription>
                                    </Field>
                                </FieldGroup>
                            </form>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
