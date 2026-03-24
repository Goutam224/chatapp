<?php
// app/Http/Middleware/ValidateApiKey.php

namespace App\Http\Middleware;

use App\Models\ApiClient;
use Closure;
use Illuminate\Http\Request;

class ValidateApiKey
{
    public function handle(Request $request, Closure $next)
    {
        $apiKey = $request->input('api_key')
                ?? $request->header('X-Api-Key');

        if (!$apiKey) {
            return response()->json([
                'success' => false,
                'message' => 'API key required',
            ], 401);
        }

        $client = ApiClient::findByKey($apiKey);

        if (!$client || !$client->isActive()) {
            return response()->json([
                'success' => false,
                'message' => 'Invalid or inactive API key',
            ], 401);
        }

        // Attach client to request for use in controller
        $request->merge(['_api_client' => $client]);

        return $next($request);
    }
}