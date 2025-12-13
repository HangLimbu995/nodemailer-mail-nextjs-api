import arcjet, { detectBot, shield, tokenBucket } from "@arcjet/next";
import { isSpoofedBot } from "@arcjet/inspect";
import { NextResponse } from "next/server";

export const aj = arcjet({
    key: process.env.ARCJET_KEY, 
    rules: [
      shield({ mode: "LIVE" }),
      detectBot({
        mode: ",
        allow: [
          "CATEGORY:SEARCH_ENGINE", 
        ],
      }),
      tokenBucket({
        mode: "LIVE",
        refillRate: 5, 
        interval: 600, 
        capacity: 5, 
      }),
    ],
  });
  

export async function  arcjetProtect (request) {
    try {
        
    const decision = await aj.protect(request, { requested: 1 }); // Deduct 5 tokens from the bucket
    console.log("Arcjet decision", decision);

    if (decision.isDenied()) {
      if (decision.reason.isRateLimit()) {
        return NextResponse.json(
          { error: "Too Many Requests", reason: decision.reason },
          { status: 429 }
        );
      } else if (decision.reason.isBot()) {
        return NextResponse.json(
          { error: "No bots allowed", reason: decision.reason },
          { status: 403 }
        );
      } else {
        return NextResponse.json(
          { error: "Forbidden", reason: decision.reason },
          { status: 403 }
        );
      }
    }

    if (decision.ip.isHosting()) {
      return NextResponse.json(
        { error: "Forbidden", reason: decision.reason },
        { status: 403 }
      );
    }

    if (decision.results.some(isSpoofedBot)) {
      return NextResponse.json(
        { error: "Forbidden", reason: decision.reason },
        { status: 403 }
      );
    }
    } catch (error) {
        console.error("Arcjet error", error);
        return NextResponse.json(
            { error: "Internal Server Error", reason: error },
            { status: 500 }
          );
    }
}