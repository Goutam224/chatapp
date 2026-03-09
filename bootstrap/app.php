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
        channels: __DIR__.'/../routes/channels.php',
        health: '/up',
    )->withBroadcasting(
    __DIR__.'/../routes/channels.php',
    [
        'middleware' => ['web'],
        'prefix' => 'broadcasting',
    ]
)


    ->withMiddleware(function (Middleware $middleware): void {

    // enable Laravel web middleware (SESSION, CSRF, COOKIE)
    $middleware->web(append: [
     
          \Illuminate\Cookie\Middleware\EncryptCookies::class,
        \Illuminate\Cookie\Middleware\AddQueuedCookiesToResponse::class,
        \Illuminate\Session\Middleware\StartSession::class,
        \Illuminate\View\Middleware\ShareErrorsFromSession::class,
        \Illuminate\Foundation\Http\Middleware\VerifyCsrfToken::class.':tus/upload,tus/upload/*,tus/complete',
        \Illuminate\Routing\Middleware\SubstituteBindings::class,
    ]);

    // your custom middleware aliases
    $middleware->alias([
        'phone.entered' => EnsurePhoneEntered::class,
        'otp.verified' => EnsureOtpVerified::class,
        'auth.session' => EnsureAuthenticated::class,
        'profile.completed' => EnsureProfileCompleted::class,
    ]);

})

    ->withExceptions(function (Exceptions $exceptions): void {
        //
    })->create();
