class BackgroundRemover {
    constructor() {
        // DOM elements
        this.uploadArea = document.getElementById('uploadArea');
        this.fileInput = document.getElementById('fileInput');
        this.uploadBtn = document.getElementById('uploadBtn');
        this.previewContainer = document.getElementById('previewContainer');
        this.imagePreview = document.getElementById('imagePreview');
        this.loadingOverlay = document.getElementById('loadingOverlay');
        this.beforeCanvas = document.getElementById('beforeCanvas');
        this.afterCanvas = document.getElementById('afterCanvas');
        this.transparentBg = document.getElementById('transparentBg');
        this.cursorControl = document.getElementById('cursorControl');
        this.controls = document.getElementById('controls');
        this.downloadBtn = document.getElementById('downloadBtn');
        this.newImageBtn = document.getElementById('newImageBtn');

        // State
        this.originalImage = null;
        this.processedImage = null;
        this.cursorPosition = 50; // percent
        this.isComparing = false;

        // Setup
        this.attachEventListeners();
    }

    attachEventListeners() {
        // Upload
        this.uploadBtn.addEventListener('click', () => this.fileInput.click());
        this.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
        this.uploadArea.addEventListener('dragover', (e) => this.handleDragOver(e));
        this.uploadArea.addEventListener('dragleave', (e) => this.handleDragLeave(e));
        this.uploadArea.addEventListener('drop', (e) => this.handleDrop(e));
        document.addEventListener('paste', (e) => this.handlePaste(e));

        // Preview Cursor (comparison)
        this.cursorControl.addEventListener('mousedown', (e) => this.startComparison(e));
        window.addEventListener('mousemove', (e) => this.isComparing && this.moveComparison(e));
        window.addEventListener('mouseup', () => this.endComparison());
        // Touch support
        this.cursorControl.addEventListener('touchstart', (e) => this.startComparison(e));
        window.addEventListener('touchmove', (e) => this.isComparing && this.moveComparison(e));
        window.addEventListener('touchend', () => this.endComparison());

        // Download/New
        this.downloadBtn.addEventListener('click', () => this.downloadImage());
        this.newImageBtn.addEventListener('click', () => this.resetInterface());
    }

    // --- Upload/Load ---

    handleDragOver(e) {
        e.preventDefault();
        this.uploadArea.classList.add('dragover');
    }
    handleDragLeave(e) {
        e.preventDefault();
        this.uploadArea.classList.remove('dragover');
    }
    handleDrop(e) {
        e.preventDefault();
        this.uploadArea.classList.remove('dragover');
        const files = e.dataTransfer.files;
        if (files.length > 0) this.processFile(files[0]);
    }
    handleFileSelect(e) {
        const file = e.target.files[0];
        if (file) this.processFile(file);
    }
    handlePaste(e) {
        const items = e.clipboardData.items;
        for (let item of items) {
            if (item.type.indexOf('image') !== -1) {
                const file = item.getAsFile();
                this.processFile(file);
                break;
            }
        }
    }
    processFile(file) {
        if (!file.type.startsWith('image/')) {
            alert('Please select an image file.');
            return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            this.originalImage = new Image();
            this.originalImage.onload = () => {
                this.showPreview();
                this.removeBackground();
            };
            this.originalImage.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    // --- Preview & Processing ---

    showPreview() {
        this.previewContainer.style.display = 'block';
        this.loadingOverlay.style.display = 'flex';

        // Set up canvases
        const containerRect = this.previewContainer.getBoundingClientRect();
        const maxWidth = containerRect.width - 60;
        const maxHeight = 400;
        const scale = Math.min(maxWidth / this.originalImage.width, maxHeight / this.originalImage.height);
        const displayWidth = this.originalImage.width * scale;
        const displayHeight = this.originalImage.height * scale;

        this.beforeCanvas.width = displayWidth;
        this.beforeCanvas.height = displayHeight;
        this.afterCanvas.width = displayWidth;
        this.afterCanvas.height = displayHeight;

        const beforeCtx = this.beforeCanvas.getContext('2d');
        beforeCtx.clearRect(0, 0, displayWidth, displayHeight);
        beforeCtx.drawImage(this.originalImage, 0, 0, displayWidth, displayHeight);

        this.cursorPosition = 50;
        this.updateComparison();
    }

    async removeBackground() {
        try {
            const canvas = document.createElement('canvas');
            canvas.width = this.originalImage.width;
            canvas.height = this.originalImage.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(this.originalImage, 0, 0);

            const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
            const formData = new FormData();
            formData.append('image', blob, 'image.png');

            const response = await fetch('/remove-background', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) throw new Error('Failed to remove background');
            const processedBlob = await response.blob();
            const processedUrl = URL.createObjectURL(processedBlob);

            this.processedImage = new Image();
            this.processedImage.onload = () => this.displayResult();
            this.processedImage.src = processedUrl;

        } catch (error) {
            alert('Failed to remove background. Please try again.');
            this.loadingOverlay.style.display = 'none';
        }
    }

    displayResult() {
        this.loadingOverlay.style.display = 'none';

        const afterCtx = this.afterCanvas.getContext('2d');
        afterCtx.clearRect(0, 0, this.afterCanvas.width, this.afterCanvas.height);
        afterCtx.drawImage(this.processedImage, 0, 0, this.afterCanvas.width, this.afterCanvas.height);

        this.controls.style.display = 'flex';
        this.updateComparison();
    }

    // --- Preview Cursor (Comparison) ---

    startComparison(e) {
        e.preventDefault();
        this.isComparing = true;
        this.moveComparison(e);
    }
    moveComparison(e) {
        if (!this.isComparing) return;
        const rect = this.imagePreview.getBoundingClientRect();
        let x;
        if (e.touches && e.touches.length > 0) {
            x = e.touches[0].clientX - rect.left;
        } else if (e.clientX !== undefined) {
            x = e.clientX - rect.left;
        } else {
            return;
        }
        this.cursorPosition = Math.max(0, Math.min(100, (x / rect.width) * 100));
        this.cursorControl.style.left = this.cursorPosition + '%';
        this.updateComparison();
    }
    endComparison() {
        this.isComparing = false;
    }
    updateComparison() {
        // Show original on left, bg-removed on right, split at cursor
        const clipPercentage = this.cursorPosition;
        this.beforeCanvas.style.clipPath = `inset(0 ${100 - clipPercentage}% 0 0)`;
        this.afterCanvas.style.clipPath = `inset(0 0 0 ${clipPercentage}%)`;
        this.transparentBg.style.opacity = this.isComparing ? '0' : '0.3';
    }

    // --- Download & Reset ---

    downloadImage() {
        this.afterCanvas.toBlob((blob) => {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'background-removed.png';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 'image/png');
    }

    resetInterface() {
        this.previewContainer.style.display = 'none';
        this.controls.style.display = 'none';
        this.fileInput.value = '';
        this.originalImage = null;
        this.processedImage = null;
        this.cursorPosition = 50;
        this.uploadArea.scrollIntoView({ behavior: 'smooth' });
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    new BackgroundRemover();
});