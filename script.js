const markedScript = document.createElement('script');
markedScript.src = 'https://cdn.jsdelivr.net/npm/marked/marked.min.js';
document.head.appendChild(markedScript);

let chatHistory = [];
let hasMessages = false;
let isWaitingForResponse = false;
let currentModel = 'gpt-4o-mini';
let currentSystem = '';
let modelLocked = false;
let previousActionButtons = null;

const modelSelector = document.getElementById('modelSelector');
const modelDropdown = document.getElementById('modelDropdown');
const selectedModelType = document.getElementById('selectedModelType');
const textInput = document.getElementById('messageInput');
const clearChatButton = document.getElementById('clearChatButton');
const sendButton = document.getElementById('sendButton');
const chatForm = document.getElementById('chatForm');
const chatContainer = document.getElementById('chatContainer');
const sidebar = document.getElementById('sidebar');
const toggleSidebarBtn = document.getElementById('toggleSidebar');
const closeSidebarBtn = document.getElementById('closeSidebar');
const mainContent = document.querySelector('main');

const modalContainer = document.createElement('div');
modalContainer.id = 'modalAlertContainer';
document.body.appendChild(modalContainer);

function modalAlert(message, duration = 3000) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-alert-overlay';
    
    const modal = document.createElement('div');
    modal.className = 'modal-alert';
    
    const content = document.createElement('div');
    content.className = 'modal-alert-content';
    
    const messageEl = document.createElement('div');
    messageEl.className = 'modal-alert-message';
    messageEl.textContent = message;
    
    const closeButton = document.createElement('button');
    closeButton.className = 'modal-alert-close';
    closeButton.innerHTML = '<span class="material-icons" style="font-size: 1.25rem;">close</span>';
    
    content.appendChild(messageEl);
    content.appendChild(closeButton);
    modal.appendChild(content);
    overlay.appendChild(modal);
    modalContainer.appendChild(overlay);
    
    requestAnimationFrame(() => {
        overlay.classList.add('show');
        modal.classList.add('show');
        document.body.classList.add('noscroll');
    });
    
    const close = () => {
        overlay.classList.remove('show');
        modal.classList.remove('show');
        document.body.classList.remove('noscroll');
        setTimeout(() => {
            modalContainer.removeChild(overlay);
        }, 200);
    };
    
    closeButton.onclick = close;
    overlay.onclick = (e) => {
        if (e.target === overlay) close();
    };
    
    if (duration) {
        setTimeout(close, duration);
    }
}

function toggleSidebar() {
    sidebar.classList.toggle('active');
    mainContent.classList.toggle('sidebar-open');
}

function closeSidebar() {
    sidebar.classList.remove('active');
    mainContent.classList.remove('sidebar-open');
}

toggleSidebarBtn.addEventListener('click', toggleSidebar);
closeSidebarBtn.addEventListener('click', closeSidebar);

document.addEventListener('click', (e) => {
    if (!sidebar.contains(e.target) && 
        !toggleSidebarBtn.contains(e.target) && 
        sidebar.classList.contains('active')) {
        closeSidebar();
    }
});

modelSelector.addEventListener('click', (e) => {
    e.stopPropagation();
    modelDropdown.classList.toggle('hidden');
});

document.addEventListener('click', () => {
    modelDropdown.classList.add('hidden');
});

document.querySelectorAll('.model-option').forEach(option => {
    option.addEventListener('click', (e) => {
        if (modelLocked) {
            modalAlert('You cannot change models while in an active chat. Please clear the chat first.');
            return;
        }
        
        const selectedModel = e.currentTarget.querySelector('p');
        currentModel = selectedModel.textContent.trim();
        
        const modelNameSpan = e.currentTarget.querySelector('span');
        if (modelNameSpan) {
            selectedModelType.textContent = modelNameSpan.textContent.trim();
        }
        modelDropdown.classList.add('hidden');
    });
});

clearChatButton.addEventListener('click', (e) => {
    e.preventDefault();
    const initialState = document.getElementById('initialState');
    if (initialState) {
        const parent = initialState.parentNode;
        parent.removeChild(initialState);
        chatContainer.innerHTML = '';
        parent.appendChild(initialState);
        initialState.classList.remove('hidden');
    }
    clearChatButton.classList.add('hidden');
    chatHistory = [];
    hasMessages = false;
    isWaitingForResponse = false;
    
    modelLocked = false;
    document.querySelectorAll('.model-option').forEach(option => {
        option.style.opacity = '1';
        option.style.cursor = 'pointer';
    });
    
    modalAlert('Chat cleared successfully!');
    updateSendButtonState();
});

textInput.addEventListener('input', function() {
    this.style.height = "auto";
    this.style.height = Math.min(this.scrollHeight, 150) + "px";
    updateSendButtonState();
});

sendButton.addEventListener('click', function(e) {
    if (!textInput.value.trim()) {
        e.preventDefault();
    }
});

chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    await handleSubmit();
});

function updateSendButtonIcon() {
    if (!textInput.value.trim()) {
        sendButton.innerHTML = `
            <span class="material-icons text-gray-500">arrow_upward</span>
        `;
        sendButton.classList.add('text-gray-300');
    } else {
        sendButton.innerHTML = `
            <span class="material-icons">arrow_upward</span>
        `;
        sendButton.classList.remove('text-gray-300');
    }
}

function updateSendButtonState() {
    sendButton.disabled = !textInput.value.trim();
    updateSendButtonIcon();
}

function addMessage(message, type) {
    if (!hasMessages) {
        const initialState = document.getElementById('initialState');
        if (initialState) {
            initialState.classList.add('hidden');
        }
        clearChatButton.classList.remove('hidden');
        hasMessages = true;
    }
    
    if (previousActionButtons) {
        previousActionButtons.remove();
        previousActionButtons = null;
    }
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    
    const bubbleDiv = document.createElement('div');
    bubbleDiv.className = `message-bubble ${type === 'user' ? 'bg-gray-100' : ''}`;
    
    if (type === 'ai' && message === 'Thinking...') {
        const loadingDots = document.createElement('div');
        loadingDots.className = 'loading-dots';
        loadingDots.innerHTML = '<span></span><span></span><span></span>';
        bubbleDiv.appendChild(loadingDots);
    } else if (type === 'ai') {
        const contentDiv = document.createElement('div');
        contentDiv.className = 'flex flex-col gap-3';
        
        marked.setOptions({
            breaks: true,
            gfm: true,
            headerIds: false,
            mangle: false
        });
        const textDiv = document.createElement('div');
        textDiv.innerHTML = marked.parse(message);
        
        textDiv.querySelectorAll('pre').forEach(preBlock => {
            const codeBlock = preBlock.querySelector('code');
            const wrapper = document.createElement('div');
            wrapper.className = 'relative';
            preBlock.parentNode.insertBefore(wrapper, preBlock);
            wrapper.appendChild(preBlock);
            codeBlock.className = 'p-4 block bg-gray-100 rounded-xl overflow-x-auto no-scrollbar';
            
            const copyButton = document.createElement('button');
            copyButton.innerHTML = '<span class="material-icons text-gray-700" style="font-size: 1rem">content_copy</span>';
            copyButton.className = 'absolute top-2 right-2 p-1.5 bg-gray-200 rounded-md transition';
            copyButton.addEventListener('click', () => {
                const code = codeBlock.textContent;
                navigator.clipboard.writeText(code).then(() => {
                    copyButton.innerHTML = '<span class="material-icons text-gray-700" style="font-size: 1rem">check</span>';
                    copyButton.title = 'Copied!';
                    setTimeout(() => {
                        copyButton.innerHTML = '<span class="material-icons text-gray-700" style="footer-size: 1rem">content_copy</span>';
                        copyButton.title = '';
                    }, 1500);
                }).catch(err => {
                    console.error('Failed to copy: ', err);
                });
            });
            codeBlock.appendChild(copyButton);
        });
        
        textDiv.querySelectorAll('p').forEach(p => { p.className = 'mb-4 last:mb-0'; });
        textDiv.querySelectorAll('ul, ol').forEach(list => { list.className = 'mb-4 pl-6'; });
        textDiv.querySelectorAll('li').forEach(item => { item.className = 'mb-2 last:mb-0'; });
        textDiv.querySelectorAll('blockquote').forEach(quote => { quote.className = 'border-l-4 border-gray-200 pl-4 my-4 italic'; });
        
        contentDiv.appendChild(textDiv);
        bubbleDiv.appendChild(contentDiv);
        
        if (message !== 'Thinking...') {
            const actionButtons = document.createElement('div');
            actionButtons.className = 'flex gap-3 mt-3 justify-start';
            
            const copyButton = document.createElement('button');
            copyButton.innerHTML = '<span class="material-icons text-gray-700" style="font-size: 1rem;">content_copy</span>';
            copyButton.title = 'Copy message';
            copyButton.addEventListener('click', () => {
                navigator.clipboard.writeText(message).then(() => {
                    modalAlert('Message copied to clipboard');
                }).catch(err => {
                    console.error('Failed to copy: ', err);
                    modalAlert('Failed to copy message');
                });
            });
            
            actionButtons.appendChild(copyButton);
            bubbleDiv.appendChild(actionButtons);
            
            previousActionButtons = actionButtons;
        }
    } else {
        bubbleDiv.textContent = message;
    }
    
    messageDiv.appendChild(bubbleDiv);
    chatContainer.appendChild(messageDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;
    
    if (type === 'ai' && message === 'Thinking...') {
        messageDiv.scrollIntoView({ behavior: 'smooth' });
    }
    return messageDiv;
}

async function handleSubmit() {
    if (isWaitingForResponse) return;
    
    const message = textInput.value.trim();
    if (!message) return;
    
    if (!modelLocked) {
        modelLocked = true;
        document.querySelectorAll('.model-option').forEach(option => {
            option.style.opacity = '0.5';
            option.style.cursor = 'not-allowed';
        });
    }
    
    isWaitingForResponse = true;
    updateSendButtonState();
    
    addMessage(message, 'user');
    const loadingMessage = addMessage('Thinking...', 'ai');
    
    textInput.value = '';
    updateSendButtonState();
    textInput.style.height = '20px';
    
    try {
        chatHistory.push({ role: 'user', content: message });
        
        const messages = chatHistory.map(entry => ({
            role: entry.role,
            content: entry.content
        }));
        
        if (currentSystem) {
            messages.unshift({ role: 'system', content: currentSystem });
        }
        
        const response = await puter.ai.chat(messages, { model: currentModel });
        const result = response.message.content[0].text || response.result.message.content;
        
        chatHistory.push({ role: 'assistant', content: result });
        addMessage(result, 'ai');
    } catch (error) {
        addMessage('No Response.', 'ai');
    } finally {
        loadingMessage.remove();
        isWaitingForResponse = false;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    AOS.init({
        duration: 800
    });
    updateSendButtonState();
});

document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const modelParam = urlParams.get('model');
    const systemParam = urlParams.get('system');
    
    if (modelParam && modelParam.startsWith('@custom/')) {
        const modelOption = Array.from(document.querySelectorAll('.model-option'))
            .find(option => option.querySelector('p')?.textContent.trim() === modelParam.trim());
        
        if (!modelOption) {
            if (systemParam) {
                currentModel = modelParam;
                currentSystem = systemParam.trim();
                selectedModelType.textContent = `Custom Model`;
                modalAlert(`Custom model set: ${currentModel}, System: ${currentSystem}`);
                return;
            } else {
                modalAlert(`Error: Custom models require "&system=" parameter.`);
                return;
            }
        }
    }
    
    const modelOption = Array.from(document.querySelectorAll('.model-option'))
        .find(option => option.querySelector('p')?.textContent.trim() === modelParam?.trim());

    if (modelParam && modelOption) {
        const selectedModel = modelOption.querySelector('p');
        const modelNameSpan = modelOption.querySelector('span');
        currentModel = selectedModel.textContent.trim();
        if (modelNameSpan) {
            selectedModelType.textContent = modelNameSpan.textContent.trim();
        }
        modalAlert(`Model switched to: ${currentModel}`);
    } else if (modelParam) {
        modalAlert(`Model "${modelParam}" not found.`);
    }
});

document.querySelectorAll('.suggestion-bubble').forEach(bubble => {
    bubble.addEventListener('click', function() {
        messageInput.value = this.textContent.trim();
        messageInput.focus();
        updateSendButtonState();
    });
});