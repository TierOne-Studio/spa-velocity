import { useEffect, useState } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@shared/components/ui/card";
import { Button } from "@shared/components/ui/button";
import { IconLoader2, IconCircleCheck, IconCircleX } from "@tabler/icons-react";
import { fetchWithAuth } from "@shared/lib/fetch-with-auth";
import { useAuth } from "@shared/context/AuthContext";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

type VerificationStatus = "loading" | "success" | "error";

export function VerifyEmailPage() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { refreshSession } = useAuth();
    const [status, setStatus] = useState<VerificationStatus>("loading");
    const [message, setMessage] = useState("");

    useEffect(() => {
        const token = searchParams.get("token");

        if (!token) {
            setStatus("error");
            setMessage("Invalid verification link. No token provided.");
            return;
        }

        verifyEmail(token);
    }, [searchParams]);

    const verifyEmail = async (token: string) => {
        try {
            const response = await fetchWithAuth(`${API_BASE_URL}/api/auth/verify-email`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token }),
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({ message: "Verification failed" }));
                throw new Error(error.message || "Verification failed");
            }

            // Capture bearer token issued on successful email verification and refresh session
            const bearerToken = response.headers.get("set-auth-token");
            if (bearerToken) {
                localStorage.setItem("bearer_token", bearerToken);
            }
            await refreshSession();

            setStatus("success");
            setMessage("Your email has been verified successfully!");

            // Land on the pending-approval route first so approval gating
            // doesn't depend on the protected app route resolving in time.
            setTimeout(() => navigate("/pending-approval"), 3000);
        } catch (error) {
            setStatus("error");
            setMessage(error instanceof Error ? error.message : "Verification failed");
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-background p-4">
            <Card className="w-full max-w-md">
                <CardHeader className="text-center">
                    <CardTitle className="text-2xl">Email Verification</CardTitle>
                    <CardDescription>
                        {status === "loading" && "Verifying your email address..."}
                        {status === "success" && "Verification complete"}
                        {status === "error" && "Verification failed"}
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col items-center gap-4">
                    {status === "loading" && (
                        <IconLoader2 className="h-16 w-16 animate-spin text-primary" />
                    )}

                    {status === "success" && (
                        <>
                            <IconCircleCheck className="h-16 w-16 text-green-500" />
                            <p className="text-center text-muted-foreground">{message}</p>
                            <p className="text-sm text-muted-foreground">
                                Redirecting to account status...
                            </p>
                        </>
                    )}

                    {status === "error" && (
                        <>
                            <IconCircleX className="h-16 w-16 text-destructive" />
                            <p className="text-center text-muted-foreground">{message}</p>
                            <Button asChild>
                                <Link to="/login">Go to Login</Link>
                            </Button>
                        </>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
