<?php 
namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use App\Helpers\AuthHelper;

class EnsurePhoneEntered
{
    public function handle(Request $request, Closure $next)
    {
        // If already logged in, don't allow verifyphone
        if (AuthHelper::check()) {
            return redirect()->route('dashboard');
        }

        // If phone not entered, redirect to login
        if (!session()->has('auth_phone')) {
            return redirect()->route('login');
        }

        return $next($request);
    }
}
