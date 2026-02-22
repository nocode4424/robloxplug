--[[
	RobloxPlug - AI Script Generator Plugin
	Connects to the RobloxPlug web app via WebSocket and receives
	AI-generated scripts to insert into your game.
]]

local HttpService = game:GetService("HttpService")
local Selection = game:GetService("Selection")

-- Plugin setup
local toolbar = plugin:CreateToolbar("RobloxPlug")
local toggleButton = toolbar:CreateButton(
	"RobloxPlug",
	"Connect to AI Script Generator",
	"rbxassetid://4458901886", -- generic plugin icon
	"RobloxPlug"
)

-- Widget setup
local widgetInfo = DockWidgetPluginGuiInfo.new(
	Enum.InitialDockState.Right,
	false, -- initially disabled
	false, -- override previous state
	300,   -- default width
	400,   -- default height
	250,   -- min width
	200    -- min height
)

local widget = plugin:CreateDockWidgetPluginGui("RobloxPlugWidget", widgetInfo)
widget.Title = "RobloxPlug"

-- UI Construction
local mainFrame = Instance.new("Frame")
mainFrame.Size = UDim2.new(1, 0, 1, 0)
mainFrame.BackgroundColor3 = Color3.fromRGB(30, 30, 30)
mainFrame.BorderSizePixel = 0
mainFrame.Parent = widget

local layout = Instance.new("UIListLayout")
layout.SortOrder = Enum.SortOrder.LayoutOrder
layout.Padding = UDim.new(0, 8)
layout.Parent = mainFrame

local padding = Instance.new("UIPadding")
padding.PaddingTop = UDim.new(0, 12)
padding.PaddingLeft = UDim.new(0, 12)
padding.PaddingRight = UDim.new(0, 12)
padding.PaddingBottom = UDim.new(0, 12)
padding.Parent = mainFrame

-- Title
local titleLabel = Instance.new("TextLabel")
titleLabel.Size = UDim2.new(1, 0, 0, 24)
titleLabel.BackgroundTransparency = 1
titleLabel.Text = "RobloxPlug"
titleLabel.TextColor3 = Color3.fromRGB(255, 255, 255)
titleLabel.TextSize = 18
titleLabel.Font = Enum.Font.GothamBold
titleLabel.TextXAlignment = Enum.TextXAlignment.Left
titleLabel.LayoutOrder = 1
titleLabel.Parent = mainFrame

-- Server URL Input
local urlLabel = Instance.new("TextLabel")
urlLabel.Size = UDim2.new(1, 0, 0, 16)
urlLabel.BackgroundTransparency = 1
urlLabel.Text = "Server URL"
urlLabel.TextColor3 = Color3.fromRGB(180, 180, 180)
urlLabel.TextSize = 12
urlLabel.Font = Enum.Font.Gotham
urlLabel.TextXAlignment = Enum.TextXAlignment.Left
urlLabel.LayoutOrder = 2
urlLabel.Parent = mainFrame

local urlInput = Instance.new("TextBox")
urlInput.Size = UDim2.new(1, 0, 0, 30)
urlInput.BackgroundColor3 = Color3.fromRGB(50, 50, 50)
urlInput.BorderSizePixel = 0
urlInput.Text = "ws://localhost:8080"
urlInput.PlaceholderText = "ws://localhost:8080"
urlInput.TextColor3 = Color3.fromRGB(255, 255, 255)
urlInput.PlaceholderColor3 = Color3.fromRGB(120, 120, 120)
urlInput.TextSize = 13
urlInput.Font = Enum.Font.GothamMedium
urlInput.ClearTextOnFocus = false
urlInput.LayoutOrder = 3
urlInput.Parent = mainFrame

local urlCorner = Instance.new("UICorner")
urlCorner.CornerRadius = UDim.new(0, 4)
urlCorner.Parent = urlInput

local urlPad = Instance.new("UIPadding")
urlPad.PaddingLeft = UDim.new(0, 8)
urlPad.PaddingRight = UDim.new(0, 8)
urlPad.Parent = urlInput

-- Token Input
local tokenLabel = Instance.new("TextLabel")
tokenLabel.Size = UDim2.new(1, 0, 0, 16)
tokenLabel.BackgroundTransparency = 1
tokenLabel.Text = "Session Token"
tokenLabel.TextColor3 = Color3.fromRGB(180, 180, 180)
tokenLabel.TextSize = 12
tokenLabel.Font = Enum.Font.Gotham
tokenLabel.TextXAlignment = Enum.TextXAlignment.Left
tokenLabel.LayoutOrder = 4
tokenLabel.Parent = mainFrame

local tokenInput = Instance.new("TextBox")
tokenInput.Size = UDim2.new(1, 0, 0, 30)
tokenInput.BackgroundColor3 = Color3.fromRGB(50, 50, 50)
tokenInput.BorderSizePixel = 0
tokenInput.Text = ""
tokenInput.PlaceholderText = "Paste session token here..."
tokenInput.TextColor3 = Color3.fromRGB(255, 255, 255)
tokenInput.PlaceholderColor3 = Color3.fromRGB(120, 120, 120)
tokenInput.TextSize = 13
tokenInput.Font = Enum.Font.GothamMedium
tokenInput.ClearTextOnFocus = false
tokenInput.LayoutOrder = 5
tokenInput.Parent = mainFrame

local tokenCorner = Instance.new("UICorner")
tokenCorner.CornerRadius = UDim.new(0, 4)
tokenCorner.Parent = tokenInput

local tokenPad = Instance.new("UIPadding")
tokenPad.PaddingLeft = UDim.new(0, 8)
tokenPad.PaddingRight = UDim.new(0, 8)
tokenPad.Parent = tokenInput

-- Connect Button
local connectBtn = Instance.new("TextButton")
connectBtn.Size = UDim2.new(1, 0, 0, 32)
connectBtn.BackgroundColor3 = Color3.fromRGB(0, 120, 255)
connectBtn.BorderSizePixel = 0
connectBtn.Text = "Connect"
connectBtn.TextColor3 = Color3.fromRGB(255, 255, 255)
connectBtn.TextSize = 14
connectBtn.Font = Enum.Font.GothamBold
connectBtn.LayoutOrder = 6
connectBtn.Parent = mainFrame

local connectCorner = Instance.new("UICorner")
connectCorner.CornerRadius = UDim.new(0, 4)
connectCorner.Parent = connectBtn

-- Status Label
local statusLabel = Instance.new("TextLabel")
statusLabel.Size = UDim2.new(1, 0, 0, 18)
statusLabel.BackgroundTransparency = 1
statusLabel.Text = "Status: Disconnected"
statusLabel.TextColor3 = Color3.fromRGB(255, 100, 100)
statusLabel.TextSize = 12
statusLabel.Font = Enum.Font.Gotham
statusLabel.TextXAlignment = Enum.TextXAlignment.Left
statusLabel.LayoutOrder = 7
statusLabel.Parent = mainFrame

-- Log Header
local logHeader = Instance.new("TextLabel")
logHeader.Size = UDim2.new(1, 0, 0, 16)
logHeader.BackgroundTransparency = 1
logHeader.Text = "Script Log"
logHeader.TextColor3 = Color3.fromRGB(180, 180, 180)
logHeader.TextSize = 12
logHeader.Font = Enum.Font.GothamBold
logHeader.TextXAlignment = Enum.TextXAlignment.Left
logHeader.LayoutOrder = 8
logHeader.Parent = mainFrame

-- Scrollable Log
local logScroll = Instance.new("ScrollingFrame")
logScroll.Size = UDim2.new(1, 0, 1, -220)
logScroll.BackgroundColor3 = Color3.fromRGB(20, 20, 20)
logScroll.BorderSizePixel = 0
logScroll.ScrollBarThickness = 6
logScroll.CanvasSize = UDim2.new(0, 0, 0, 0)
logScroll.AutomaticCanvasSize = Enum.AutomaticSize.Y
logScroll.LayoutOrder = 9
logScroll.Parent = mainFrame

local logCorner = Instance.new("UICorner")
logCorner.CornerRadius = UDim.new(0, 4)
logCorner.Parent = logScroll

local logLayout = Instance.new("UIListLayout")
logLayout.SortOrder = Enum.SortOrder.LayoutOrder
logLayout.Padding = UDim.new(0, 2)
logLayout.Parent = logScroll

local logPad = Instance.new("UIPadding")
logPad.PaddingTop = UDim.new(0, 4)
logPad.PaddingLeft = UDim.new(0, 6)
logPad.PaddingRight = UDim.new(0, 6)
logPad.Parent = logScroll

-- State
local logCount = 0

local function addLog(text: string, color: Color3?)
	logCount += 1
	local entry = Instance.new("TextLabel")
	entry.Size = UDim2.new(1, 0, 0, 0)
	entry.AutomaticSize = Enum.AutomaticSize.Y
	entry.BackgroundTransparency = 1
	entry.Text = text
	entry.TextColor3 = color or Color3.fromRGB(200, 200, 200)
	entry.TextSize = 11
	entry.Font = Enum.Font.Code
	entry.TextXAlignment = Enum.TextXAlignment.Left
	entry.TextWrapped = true
	entry.LayoutOrder = logCount
	entry.Parent = logScroll
end

-- Resolve a parentPath string (e.g. "ServerScriptService") to a game instance
local function resolveParent(parentPath: string): Instance?
	local parts = string.split(parentPath, ".")
	local current: Instance = game

	for _, part in parts do
		local child = current:FindFirstChild(part)
		if not child then
			-- Try common service names
			local success, service = pcall(function()
				return game:GetService(part)
			end)
			if success and service then
				current = service
			else
				return nil
			end
		else
			current = child
		end
	end

	return current
end

-- Create a script instance from the payload
local function createScript(payload)
	local scriptName = payload.scriptName
	local scriptType = payload.scriptType
	local parentPath = payload.parentPath
	local source = payload.source

	local parent = resolveParent(parentPath)
	if not parent then
		local msg = "Could not resolve parent path: " .. parentPath
		warn("[RobloxPlug] " .. msg)
		addLog("ERROR: " .. msg, Color3.fromRGB(255, 80, 80))
		return
	end

	local scriptInstance: Instance
	if scriptType == "LocalScript" then
		scriptInstance = Instance.new("LocalScript")
	elseif scriptType == "ModuleScript" then
		scriptInstance = Instance.new("ModuleScript")
	else
		scriptInstance = Instance.new("Script")
	end

	scriptInstance.Name = scriptName
	scriptInstance.Source = source
	scriptInstance.Parent = parent

	local msg = string.format(
		"Created %s '%s' in %s",
		scriptType,
		scriptName,
		parent:GetFullName()
	)
	print("[RobloxPlug] " .. msg)
	addLog(msg, Color3.fromRGB(100, 255, 100))

	-- Select the new script for the user
	Selection:Set({ scriptInstance })
end

-- WebSocket connection handling
-- NOTE: Roblox Studio does not natively support WebSocket connections in plugins.
-- This plugin uses HttpService for polling as a fallback.
-- For true WebSocket support, you would need a companion local server or
-- use a Roblox-compatible WebSocket module.

local connected = false
local pollConnection = nil

local function disconnect()
	connected = false
	if pollConnection then
		pollConnection = false
	end
	statusLabel.Text = "Status: Disconnected"
	statusLabel.TextColor3 = Color3.fromRGB(255, 100, 100)
	connectBtn.Text = "Connect"
	connectBtn.BackgroundColor3 = Color3.fromRGB(0, 120, 255)
	addLog("Disconnected from server")
end

local function connect()
	local serverUrl = urlInput.Text
	local sessionToken = tokenInput.Text

	if sessionToken == "" then
		addLog("Please enter a session token", Color3.fromRGB(255, 200, 80))
		return
	end

	-- Convert ws:// URL to http:// for polling
	local httpUrl = serverUrl:gsub("^ws://", "http://"):gsub("^wss://", "https://")

	-- Register the session via HTTP
	addLog("Connecting to " .. serverUrl .. "...")
	statusLabel.Text = "Status: Connecting..."
	statusLabel.TextColor3 = Color3.fromRGB(255, 200, 80)

	-- Register this plugin with the server via HTTP
	local success, err = pcall(function()
		local response = HttpService:RequestAsync({
			Url = httpUrl .. "/api/session/" .. sessionToken .. "/register",
			Method = "POST",
			Headers = { ["Content-Type"] = "application/json" },
			Body = HttpService:JSONEncode({ source = "studio-plugin" }),
		})

		if response.Success then
			connected = true
			pollConnection = true
			statusLabel.Text = "Status: Connected"
			statusLabel.TextColor3 = Color3.fromRGB(100, 255, 100)
			connectBtn.Text = "Disconnect"
			connectBtn.BackgroundColor3 = Color3.fromRGB(200, 50, 50)
			addLog("Connected! Session: " .. string.sub(sessionToken, 1, 8) .. "...")
			print("[RobloxPlug] Connected to session: " .. sessionToken)
		else
			addLog("Failed to connect: " .. tostring(response.StatusCode), Color3.fromRGB(255, 80, 80))
		end
	end)

	if not success then
		addLog("Connection error: " .. tostring(err), Color3.fromRGB(255, 80, 80))
		statusLabel.Text = "Status: Error"
		statusLabel.TextColor3 = Color3.fromRGB(255, 100, 100)
		return
	end

	-- Start polling for scripts
	-- In a production setup, the server would have a /api/session/:token/poll
	-- endpoint that returns pending scripts. For now, the WebSocket push
	-- happens server-side; this plugin demonstrates the script creation logic.
	-- To fully integrate, add a polling endpoint to the server.
	task.spawn(function()
		while pollConnection and connected do
			task.wait(2)
			-- Poll for pending scripts
			local pollSuccess, pollErr = pcall(function()
				local resp = HttpService:RequestAsync({
					Url = httpUrl .. "/api/session/" .. sessionToken .. "/scripts",
					Method = "GET",
					Headers = { ["Content-Type"] = "application/json" },
				})
				if resp.Success and resp.Body ~= "[]" and resp.Body ~= "" then
					local ok, scripts = pcall(function()
						return HttpService:JSONDecode(resp.Body)
					end)
					if ok and type(scripts) == "table" then
						for _, payload in scripts do
							if payload.scriptName and payload.source then
								createScript(payload)
							end
						end
					end
				end
			end)
			if not pollSuccess then
				-- Silently ignore poll errors (endpoint may not exist yet)
			end
		end
	end)
end

-- Button handlers
connectBtn.MouseButton1Click:Connect(function()
	if connected then
		disconnect()
	else
		connect()
	end
end)

toggleButton.Click:Connect(function()
	widget.Enabled = not widget.Enabled
end)

addLog("RobloxPlug loaded. Enter your session token and click Connect.")
