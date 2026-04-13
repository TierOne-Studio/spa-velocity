import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@shared/context/AuthContext";
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
    FieldGroup,
    FieldLabel,
} from "@/shared/components/ui/field";
import { ThemeToggle } from "@/shared/components/ui/theme-toggle";

export default function SignupPage() {
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const { signup } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        if (password !== confirmPassword) {
            toast.error("Passwords do not match");
            setIsLoading(false);
            return;
        }

        try {
            await signup({ name, email, password });
            // Check for pending invitation
            const pendingInvitationId = sessionStorage.getItem("pendingInvitationId");
            if (pendingInvitationId) {
                sessionStorage.removeItem("pendingInvitationId");
                toast.success("Account created successfully!");
                navigate(`/accept-invitation/${pendingInvitationId}`, { replace: true });
            } else {
                toast.success("Account created! Your registration is pending approval.");
                navigate("/pending-approval", { replace: true });
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : "Signup failed";
            toast.error(message);
        } finally {
            setIsLoading(false);
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
                            <CardTitle>Create an account</CardTitle>
                            <CardDescription>
                                Enter your information below to create your account
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleSubmit}>
                                <FieldGroup>
                                    <Field>
                                        <FieldLabel htmlFor="name">Full Name</FieldLabel>
                                        <Input
                                            id="name"
                                            type="text"
                                            placeholder="John Doe"
                                            required
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                        />
                                    </Field>
                                    <Field>
                                        <FieldLabel htmlFor="email">Email</FieldLabel>
                                        <Input
                                            id="email"
                                            type="email"
                                            placeholder="m@example.com"
                                            required
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                        />
                                        <FieldDescription>
                                            We&apos;ll use this to contact you. We will not share your email
                                            with anyone else.
                                        </FieldDescription>
                                    </Field>
                                    <Field>
                                        <FieldLabel htmlFor="password">Password</FieldLabel>
                                        <Input
                                            id="password"
                                            type="password"
                                            required
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                        />
                                        <FieldDescription>
                                            Must be at least 8 characters long.
                                        </FieldDescription>
                                    </Field>
                                    <Field>
                                        <FieldLabel htmlFor="confirm-password">
                                            Confirm Password
                                        </FieldLabel>
                                        <Input
                                            id="confirm-password"
                                            type="password"
                                            required
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                        />
                                        <FieldDescription>Please confirm your password.</FieldDescription>
                                    </Field>
                                    <FieldGroup>
                                        <Field>
                                            <Button type="submit" disabled={isLoading}>
                                                {isLoading ? "Creating account..." : "Create Account"}
                                            </Button>
                                            <Button variant="outline" type="button">
                                                Sign up with Google
                                            </Button>
                                            <FieldDescription className="px-6 text-center">
                                                Already have an account?{" "}
                                                <Link to="/login" className="underline underline-offset-4">
                                                    Sign in
                                                </Link>
                                            </FieldDescription>
                                        </Field>
                                    </FieldGroup>
                                </FieldGroup>
                            </form>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
