# Debugging: Incoming Invitation Modal Not Showing

## Issue
Receiver gets notification but doesn't see accept/decline modal in the app.

## Root Causes (Possible)

1. **Socket event not received** - `call:invite:incoming` event is emitted but listener isn't set up yet
2. **Redux state not updating** - Socket event received but Redux state update fails
3. **Component not re-rendering** - Redux state updates but component doesn't re-render
4. **Timing issue** - Notification arrives before socket listener is ready

## Debugging Steps

### 1. Check if Socket Event is Received

**Look for these logs in the receiver's console:**
```
📨 [RECEIVER] ============================================
📨 [RECEIVER] call:invite:incoming socket event received!
📨 [RECEIVER] ============================================
```

**If you DON'T see these logs:**
- Socket event is not being received
- Check if socket is connected
- Check if listener is registered: Look for `✅ [CallFlowService] call:invite:incoming listener registered`

### 2. Check if Redux State is Updated

**Look for these logs:**
```
✅ [RECEIVER] Invitation state updated - IncomingInvitationModal should render
✅ [RECEIVER] Invitation state: {...}
```

**Check Redux state:**
```
🔄 [IncomingCallCard] Full invitation state: {...}
🔄 [IncomingCallCard] invitation.status: incoming
```

**If status is NOT "incoming":**
- Redux state update failed
- Check `handleIncomingInvitation` method

### 3. Check if Component is Rendering

**Look for these logs:**
```
🔄 [IncomingCallCard] Component rendered/updated
🔄 [IncomingCallCard] visible will be: true/false
```

**If visible is false:**
- Check invitation.status === 'incoming'
- Check invitation.remoteUserId exists
- Check invitation.remoteUserName exists

### 4. Check Notification Handler

**Look for these logs:**
```
📱 [SocketProvider] Foreground notification received
📱 [SocketProvider] Invitation notification detected
📱 [SocketProvider] Processing invitation notification
✅ [SocketProvider] handleIncomingInvitation called - modal should appear
```

**If you see "already handled":**
- Socket event already processed it
- Check if socket event logs appear

## Fixes Applied

### 1. Enhanced Logging
- Added detailed logs to socket event handler
- Added detailed logs to Redux state updates
- Added detailed logs to component rendering

### 2. Improved Notification Handler
- Better check for already-handled invitations
- Checks both Redux state and callFlowService state
- More reliable fallback when socket event is missed

### 3. Socket Listener Registration
- Ensures listeners are registered on connect
- Re-registers on reconnect
- Retries if socket not ready

## Testing Checklist

1. ✅ Send invitation from caller
2. ✅ Check receiver console for socket event logs
3. ✅ Check receiver console for Redux state update logs
4. ✅ Check receiver console for component render logs
5. ✅ Verify modal appears
6. ✅ If modal doesn't appear, check notification handler logs

## Expected Flow

1. **Caller sends invitation:**
   - Backend emits `call:invite:incoming` to receiver
   - Backend sends push notification

2. **Receiver receives socket event:**
   - `call:invite:incoming` handler fires
   - `handleIncomingInvitation` called
   - Redux state updated: `invitation.status = 'incoming'`
   - `IncomingCallCard` component re-renders
   - Modal appears

3. **Fallback (if socket event missed):**
   - Notification handler detects invitation
   - Checks if already handled
   - If not, calls `handleIncomingInvitation`
   - Redux state updated
   - Modal appears

## Common Issues

### Issue: Socket event not received
**Solution:** Check socket connection status, ensure listener is registered

### Issue: Redux state not updating
**Solution:** Check `handleIncomingInvitation` method, verify store.dispatch is called

### Issue: Component not re-rendering
**Solution:** Check if Redux state actually changed, verify component is subscribed to Redux

### Issue: Notification handler not triggering
**Solution:** Check if notification service is initialized, verify notification data format

## Next Steps

1. Test with the enhanced logging
2. Check console logs on receiver device
3. Identify which step is failing
4. Apply appropriate fix based on logs


