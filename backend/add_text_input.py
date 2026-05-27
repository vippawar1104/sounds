#!/usr/bin/env python3
"""Add text input handling to bot.py"""

bot_file = "/Users/vipulpawar/projects/pipecat-outbound/bot.py"

with open(bot_file, 'r') as f:
    content = f.read()

# Add the data message handler after the participant_connected event
handler_code = '''
    # ── Event: data message received (for text input) ────────────────────────
    @transport.event_handler("on_data_received")
    async def on_data_received(transport_instance, data_packet):
        """Handle text messages sent from the frontend"""
        try:
            import json
            message = json.loads(data_packet.data.decode('utf-8'))
            if message.get("type") == "user_text":
                text = message.get("text", "").strip()
                if text:
                    logger.info(f"Received text input: {text}")
                    # Add to context and trigger LLM
                    context.add_message({"role": "user", "content": text})
                    await task.queue_frame(LLMContextFrame(context=context))
        except Exception as e:
            logger.error(f"Error processing data message: {e}")

    # ── Run ───────────────────────────────────────────────────────────────────'''

# Find the "# ── Run ──" line and insert before it
if "# ── Event: data message received" not in content:
    content = content.replace(
        "\n    # ── Run ───────────────────────────────────────────────────────────────────",
        handler_code
    )
    
    with open(bot_file, 'w') as f:
        f.write(content)
    
    print("✅ Added text input handler to bot.py")
else:
    print("⚠️  Text input handler already exists")
