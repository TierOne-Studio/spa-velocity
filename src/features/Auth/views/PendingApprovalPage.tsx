import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { IconClock, IconLoader2 } from "@tabler/icons-react";
import { useAuth } from "@shared/context/AuthContext";

export function PendingApprovalPage() {
    const { user, refreshSession, logout } = useAuth();
    const navigate = useNavigate();
    const [isChecking, setIsChecking] = useState(false);

    useEffect(() => {
        if (user?.approvalStatus === "approved") {
            navigate("/", { replace: true });
        }

        if (user?.approvalStatus === "rejected") {
            navigate("/account-rejected", { replace: true });
        }
    }, [navigate, user?.approvalStatus]);

    const handleCheckStatus = async () => {
        setIsChecking(true);
        try {
            await refreshSession();
        } finally {
            setIsChecking(false);
        }
    };

    const handleLogout = async () => {
        await logout();
        navigate("/login", { replace: true });
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-background p-4">
            <Card className="w-full max-w-md">
                <CardHeader className="text-center">
                    <CardTitle className="text-2xl">Account Pending Approval</CardTitle>
                    <CardDescription>
                        Your registration is being reviewed
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col items-center gap-4">
                    <IconClock className="h-16 w-16 text-muted-foreground" />
                    <p className="text-center text-muted-foreground">
                        Your account has been created and is pending approval.
                        An administrator will review your registration shortly.
                    </p>
                    <p className="text-center text-sm text-muted-foreground">
                        You will receive an email notification once your account has been approved.
                    </p>
                    <div className="flex gap-3 mt-2">
                        <Button
                            variant="outline"
                            onClick={handleCheckStatus}
                            disabled={isChecking}
                        >
                            {isChecking ? (
                                <>
                                    <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Checking...
                                </>
                            ) : (
                                "Check Status"
                            )}
                        </Button>
                        <Button variant="ghost" onClick={handleLogout}>
                            Log Out
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
