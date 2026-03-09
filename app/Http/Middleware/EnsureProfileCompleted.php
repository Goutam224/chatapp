<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use App\Helpers\AuthHelper;

class EnsureProfileCompleted
{
    public function handle(Request $request, Closure $next)
    {
        $user = AuthHelper::user();

        if (!$user) {
            return redirect()->route('login');
        }

        if (empty($user->name) || $user->name === 'New User') {
            return redirect()->route('profile.setup');
        }

        return $next($request);
    }
}
