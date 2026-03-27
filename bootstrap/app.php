<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

use App\Http\Middleware\EnsurePhoneEntered;
use App\Http\Middleware\EnsureOtpVerified;
use App\Http\Middleware\EnsureAuthenticated;
use App\Http\Middleware\EnsureProfileCompleted;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        commands: __DIR__.'/../routes/console.php',

        health: '/up',
    )->withBroadcasting(
        __DIR__.'/../routes/channels.php',
        ['middleware' => ['web']]
    )


->withMiddleware(function (Middleware $middleware): void {

    // Remove BOTH default CSRF middlewares
    $middleware->web(remove: [
        \Illuminate\Foundation\Http\Middleware\VerifyCsrfToken::class,
        \Illuminate\Foundation\Http\Middleware\ValidateCsrfToken::class,
    ]);

    // Add our custom CSRF that allows Bearer tokens
    $middleware->web(append: [
        \App\Http\Middleware\VerifyCsrfOrBearer::class,
    ]);

    // your custom middleware aliases
    $middleware->alias([
        'phone.entered' => EnsurePhoneEntered::class,
        'otp.verified'  => EnsureOtpVerified::class,
        'auth.session'  => EnsureAuthenticated::class,
        'profile.completed' => EnsureProfileCompleted::class,
        'api.key' => \App\Http\Middleware\ValidateApiKey::class,
    ]);

})

    ->withExceptions(function (Exceptions $exceptions): void {
        //
    })->create();
