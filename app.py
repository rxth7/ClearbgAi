# app.py
from flask import Flask, request, send_file, jsonify, render_template
from rembg import remove
from PIL import Image
import io
import os

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/remove-background', methods=['POST'])
def remove_background():
    try:
        # Check if image file is provided
        if 'image' not in request.files:
            return jsonify({'error': 'No image file provided'}), 400
        
        file = request.files['image']
        if file.filename == '':
            return jsonify({'error': 'No image file selected'}), 400
        
        # Read the image
        input_image = file.read()
        
        # Remove background using rembg
        output_image = remove(input_image)
        
        # Create a BytesIO object to return the processed image
        img_io = io.BytesIO(output_image)
        img_io.seek(0)
        
        return send_file(
            img_io,
            mimetype='image/png',
            as_attachment=False,
            download_name='background_removed.png'
        )
        
    except Exception as e:
        print(f"Error processing image: {str(e)}")
        return jsonify({'error': 'Failed to process image'}), 500

@app.errorhandler(413)
def too_large(e):
    return jsonify({'error': 'File too large. Maximum size is 16MB.'}), 413

if __name__ == '__main__':
    # Create static directory if it doesn't exist
    os.makedirs('static', exist_ok=True)
    os.makedirs('templates', exist_ok=True)
    
    app.run(debug=True, host='0.0.0.0', port=5000)
