export interface User {
    id: string;
    name: string;
    email: string;
    role?: string;
    image?: string;
    emailVerified?: boolean;
    banned?: boolean;
    banReason?: string;
    banExpires?: Date;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface AuthState {
    user: User | null;
    isAuthenticated: boolean;
}

export interface LoginCredentials {
    email: string;
    password: string;
}

export interface SignupCredentials {
    name: string;
    email: string;
    password: string;
}
