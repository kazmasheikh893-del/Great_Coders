import os
import uuid
from datetime import datetime, timedelta
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from werkzeug.utils import secure_filename
from database import db, HazardReport, UserActivity

app = Flask(__name__)
CORS(app)

# Configuration
app.config['SECRET_KEY'] = 'hackathon-secret-key'
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///saferoute.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['UPLOAD_FOLDER'] = 'uploads'

# Create uploads folder
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

# Initialize database
db.init_app(app)

with app.app_context():
    db.create_all()
    print("✅ Database created!")

@app.route('/')
def home():
    return jsonify({
        'name': 'SafeRoute API',
        'status': 'running',
        'endpoints': ['/api/hazards', '/api/report', '/api/stats']
    })

@app.route('/api/hazards', methods=['GET'])
def get_hazards():
    hours = request.args.get('hours', 48, type=int)
    cutoff = datetime.utcnow() - timedelta(hours=hours)
    hazards = HazardReport.query.filter(
        HazardReport.created_at > cutoff
    ).order_by(HazardReport.created_at.desc()).all()
    
    return jsonify({
        'success': True,
        'count': len(hazards),
        'hazards': [h.to_dict() for h in hazards]
    })

@app.route('/api/report', methods=['POST'])
def report_hazard():
    try:
        data = request.json
        
        hazard = HazardReport(
            type=data['type'],
            lat=data['lat'],
            lng=data['lng'],
            description=data.get('description', ''),
            user_id=data.get('user_id', 'anonymous')
        )
        
        db.session.add(hazard)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'hazard': hazard.to_dict()
        }), 201
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/verify/<int:hazard_id>', methods=['POST'])
def verify_hazard(hazard_id):
    hazard = HazardReport.query.get(hazard_id)
    if not hazard:
        return jsonify({'success': False, 'error': 'Not found'}), 404
    
    hazard.verification_count += 1
    if hazard.verification_count >= 3:
        hazard.verified = True
    
    db.session.commit()
    return jsonify({'success': True})

@app.route('/api/stats', methods=['GET'])
def get_stats():
    active = HazardReport.query.filter(
        HazardReport.created_at > datetime.utcnow() - timedelta(hours=48)
    ).count()
    
    total = HazardReport.query.count()
    verified = HazardReport.query.filter_by(verified=True).count()
    
    return jsonify({
        'success': True,
        'stats': {
            'active_hazards': active,
            'total_reports': total,
            'verified_hazards': verified
        }
    })

@app.route('/api/search', methods=['GET'])
def search():
    query = request.args.get('q', '').lower()
    
    locations = {
        'central park': {'lat': 40.7850, 'lng': -73.9680},
        'times square': {'lat': 40.7580, 'lng': -73.9855},
        'soho': {'lat': 40.7230, 'lng': -74.0030}
    }
    
    results = []
    for name, coords in locations.items():
        if query in name:
            results.append({'name': name.title(), **coords})
    
    return jsonify({'success': True, 'results': results[:3]})

if __name__ == '__main__':
    print("\n" + "="*50)
    print("🚀 SafeRoute Backend Starting...")
    print("="*50)
    print("📍 API URL: http://localhost:5000")
    print("📊 Database: saferoute.db")
    print("="*50 + "\n")
    app.run(debug=True, port=5000)