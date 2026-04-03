<?php

namespace App\Http\Middleware;

use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken as Middleware;

class VerifyCsrfOrBearer extends Middleware
{
    protected $except = [
        'tus/upload',
        'tus/upload/*',
        'tus/complete',
        'send-otp',      // ← add this
    'verify-otp',
    'auth/token',
            'broadcasting/auth',
    ];

    public function handle($request, \Closure $next)
    {
        // Bearer token = API client = skip CSRF
        if ($request->bearerToken()) {
            return $next($request);
        }

        // Browser = normal CSRF check
        return parent::handle($request, $next);
    }
}
