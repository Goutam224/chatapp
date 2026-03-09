<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use App\Helpers\AuthHelper;

class EnsureOtpVerified
{
    public function handle(Request $request, Closure $next)
    {
        // Must be authenticated using token
        if (!AuthHelper::check()) {
            return redirect()->route('login');
        }

        return $next($request);
    }
}
