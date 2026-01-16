import logging
import asyncio
import threading
import html
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import ApplicationBuilder, ContextTypes, CommandHandler, CallbackQueryHandler
import py_process
import py_logger

# Configure logging
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)

class TelegramBot:
    def __init__(self, token, allowed_chat_ids):
        self.token = token
        self.allowed_chat_ids = allowed_chat_ids
        self.application = None
        self.loop = None

    async def start(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        if not self._check_auth(update):
            return
            
        # Check if there are arguments (deep linking or direct usage)
        if context.args:
            # If arguments provided, treat as start_script command
            await self.start_script(update, context)
            return

        await context.bot.send_message(
            chat_id=update.effective_chat.id, 
            text="Hello! I'm your Python Manager Bot. Use /list to see scripts."
        )

    async def help_command(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        if not self._check_auth(update):
            return
            
        help_text = """
<b>🤖 Python Manager Bot Help</b>

<b>Commands:</b>
/list - Show interactive script manager
/run &lt;id&gt; - Start a specific script
/stop &lt;id&gt; - Stop a specific script
/logs &lt;id&gt; - View recent logs for a script
/help - Show this help message

<b>Interactive Mode (/list):</b>
1. Select a script from the list.
2. Use the buttons below to Start, Stop, Restart, or View Logs.
"""
        await context.bot.send_message(chat_id=update.effective_chat.id, text=help_text, parse_mode='HTML')

    async def list_scripts(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        if not self._check_auth(update):
            return
        
        status_list = py_process.vf_get_all_status()
        
        # Store scripts in user_data for button handling
        context.user_data['scripts'] = {s['id']: s['name'] for s in status_list}
        
        # Group scripts
        grouped_scripts = {}
        for script in status_list:
            group = script.get('group', 'Default')
            if group not in grouped_scripts:
                grouped_scripts[group] = []
            grouped_scripts[group].append(script)

        keyboards = []
        
        # Loop through groups and add buttons
        for group_name in sorted(grouped_scripts.keys()):
            # Add Header for Group with visual emphasis
            header_text = f"🔹🔹🔹 {group_name} 🔹🔹🔹"
            keyboards.append([InlineKeyboardButton(header_text, callback_data="noop")])
            
            # Add Scripts in this group
            for script in grouped_scripts[group_name]:
                status_emoji = "🟢" if script.get('status') == 'running' else "🔴"
                # Use spaces for indentation instead of tree chars to cleaner look
                button_text = f"   {status_emoji} {script['name']}"
                keyboards.append([InlineKeyboardButton(button_text, callback_data=f"select_{script['id']}")])
        
        # Control buttons
        controls = [
            InlineKeyboardButton("▶ Start", callback_data="action_start"),
            InlineKeyboardButton("⏹ Stop", callback_data="action_stop"),
            InlineKeyboardButton("🔄 Restart", callback_data="action_restart"),
            InlineKeyboardButton("📝 Logs", callback_data="action_log"),
        ]
        keyboards.append(controls)
        
        reply_markup = InlineKeyboardMarkup(keyboards)
        
        message_text = "📜 <b>Scripts Manager</b>\n\nSelect a script to manage:"
        
        # Check if we are updating an existing message (from callback) or sending new
        if update.callback_query:
            await update.callback_query.edit_message_text(text=message_text, reply_markup=reply_markup, parse_mode='HTML')
        else:
            await context.bot.send_message(chat_id=update.effective_chat.id, text=message_text, reply_markup=reply_markup, parse_mode='HTML')

    async def button_handler(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        query = update.callback_query
        await query.answer()
        
        data = query.data
        
        if data == 'noop':
            # Do nothing for header buttons
            return

        if data.startswith("select_"):
            script_id = data.replace("select_", "")
            context.user_data['selected_script_id'] = script_id
            
            # Get script name
            script_name = context.user_data.get('scripts', {}).get(script_id, script_id)
            
            await query.edit_message_text(
                text=f"✅ Selected: <b>{script_name}</b>\n\nChoose an action below:",
                reply_markup=query.message.reply_markup,
                parse_mode='HTML'
            )
            
        elif data.startswith("action_"):
            action = data.replace("action_", "")
            script_id = context.user_data.get('selected_script_id')
            
            if not script_id:
                await context.bot.send_message(chat_id=update.effective_chat.id, text="⚠️ Please select a script first!")
                return
            
            script_name = context.user_data.get('scripts', {}).get(script_id, script_id)
            
            if action == 'start':
                result = py_process.vf_start_script(script_id)
                msg = f"▶ Starting <b>{script_name}</b>...\nResult: {result.get('success')}"
                await context.bot.send_message(chat_id=update.effective_chat.id, text=msg, parse_mode='HTML')
                await self.list_scripts(update, context) # Refresh list
                
            elif action == 'stop':
                result = py_process.vf_stop_script(script_id)
                msg = f"⏹ Stopping <b>{script_name}</b>...\nResult: {result.get('success')}"
                await context.bot.send_message(chat_id=update.effective_chat.id, text=msg, parse_mode='HTML')
                await self.list_scripts(update, context) # Refresh list
                
            elif action == 'restart':
                result = py_process.vf_restart_script(script_id)
                msg = f"🔄 Restarting <b>{script_name}</b>...\nResult: {result.get('success')}"
                await context.bot.send_message(chat_id=update.effective_chat.id, text=msg, parse_mode='HTML')
                await self.list_scripts(update, context) # Refresh list
                
            elif action == 'log':
                logs = py_logger.vf_read_recent_logs(script_id, 10)
                if logs:
                    log_text = "\n".join(logs)
                    # Strip ANSI codes using the helper in py_process
                    log_text = py_process.vf_strip_ansi(log_text)
                    
                    if len(log_text) > 4000:
                        log_text = log_text[-4000:]
                    
                    safe_id = html.escape(script_id)
                    safe_logs = html.escape(log_text)
                    
                    await context.bot.send_message(
                        chat_id=update.effective_chat.id, 
                        text=f"📝 <b>Logs for {safe_id}</b>:\n<pre>{safe_logs}</pre>", 
                        parse_mode='HTML'
                    )
                else:
                    await context.bot.send_message(chat_id=update.effective_chat.id, text=f"No logs found for <b>{script_id}</b>.", parse_mode='HTML')

    async def start_script(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        if not self._check_auth(update):
            return
        
        if not context.args:
            await context.bot.send_message(chat_id=update.effective_chat.id, text="Usage: /start <script_id>")
            return

        script_id = context.args[0]
        result = py_process.vf_start_script(script_id)
        
        if result['success']:
            await context.bot.send_message(chat_id=update.effective_chat.id, text=f"✅ Script `{script_id}` started.", parse_mode='Markdown')
        else:
            await context.bot.send_message(chat_id=update.effective_chat.id, text=f"❌ Failed to start `{script_id}`: {result.get('error')}", parse_mode='Markdown')

    async def stop_script(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        if not self._check_auth(update):
            return

        if not context.args:
            await context.bot.send_message(chat_id=update.effective_chat.id, text="Usage: /stop <script_id>")
            return

        script_id = context.args[0]
        result = py_process.vf_stop_script(script_id)
        
        if result['success']:
            await context.bot.send_message(chat_id=update.effective_chat.id, text=f"🛑 Script `{script_id}` stopped.", parse_mode='Markdown')
        else:
            await context.bot.send_message(chat_id=update.effective_chat.id, text=f"❌ Failed to stop `{script_id}`: {result.get('error')}", parse_mode='Markdown')

    async def get_logs(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        if not self._check_auth(update):
            return

        if not context.args:
            await context.bot.send_message(chat_id=update.effective_chat.id, text="Usage: /logs <script_id>")
            return

        script_id = context.args[0]
        logs = py_logger.vf_read_recent_logs(script_id, 10)
        
        if logs:
            log_text = "\n".join(logs)
            # Strip ANSI codes
            log_text = py_process.vf_strip_ansi(log_text)
            
            if len(log_text) > 4000:
                log_text = log_text[-4000:]
            
            # Escape content for HTML
            safe_id = html.escape(script_id)
            safe_logs = html.escape(log_text)
            
            await context.bot.send_message(
                chat_id=update.effective_chat.id, 
                text=f"📝 <b>Logs for {safe_id}</b>:\n<pre>{safe_logs}</pre>", 
                parse_mode='HTML'
            )
        else:
             await context.bot.send_message(chat_id=update.effective_chat.id, text=f"No logs found for `{script_id}`.", parse_mode='Markdown')

    def _check_auth(self, update: Update):
        if not update.effective_chat:
            return False
            
        user_id = update.effective_chat.id
        if not self.allowed_chat_ids:
            print(f"WARNING: Unauthorized access attempt from {user_id} (No allowed IDs configured)")
            return False
            
        is_allowed = user_id in self.allowed_chat_ids
        if not is_allowed:
             print(f"WARNING: Unauthorized access attempt from {user_id}")
        else:
             print(f"INFO: Authorized command from {user_id}")
            
        return is_allowed

    def run(self):
        try:
            print("Initializing Telegram Bot Application...")
            # Check for proxy settings in config or env
            proxy_url = None
            if py_process.vg_config.get('telegram', {}).get('proxy_url'):
                proxy_url = py_process.vg_config['telegram']['proxy_url']
                print(f"Using proxy from config: {proxy_url}")
            
            # Build application
            builder = ApplicationBuilder().token(self.token)
            if proxy_url:
                builder = builder.proxy_url(proxy_url)
                builder = builder.get_updates_proxy_url(proxy_url)

            self.application = builder.build()
            
            self.application.add_handler(CommandHandler('start', self.start))
            self.application.add_handler(CommandHandler('help', self.help_command))
            self.application.add_handler(CommandHandler('list', self.list_scripts))
            self.application.add_handler(CommandHandler('run', self.start_script))
            self.application.add_handler(CommandHandler('stop', self.stop_script))
            self.application.add_handler(CommandHandler('logs', self.get_logs))
            self.application.add_handler(CallbackQueryHandler(self.button_handler))

            print("Telegram Bot polling starting...")
            self.application.run_polling()
        except Exception as e:
            print(f"CRITICAL: Telegram Bot failed to start: {e}")
            import traceback
            traceback.print_exc()

def run_bot_thread(token, allowed_chat_ids):
    print(f"Bot thread started. Token: {token[:5]}... Chat IDs: {allowed_chat_ids}")
    bot = TelegramBot(token, allowed_chat_ids)
    bot.run()
