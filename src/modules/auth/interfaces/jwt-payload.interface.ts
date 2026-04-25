export interface JwtPayload {
    sub: string;           // employee internal UUID
    email: string;
    role: string;
    hcmEmployeeId: string;
    iat?: number;
    exp?: number;
}