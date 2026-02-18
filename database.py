from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db = SQLAlchemy()

class HazardReport(db.Model):
    __tablename__ = 'hazard_reports'
    
    id = db.Column(db.Integer, primary_key=True)
    type = db.Column(db.String(50), nullable=False)
    lat = db.Column(db.Float, nullable=False)
    lng = db.Column(db.Float, nullable=False)
    description = db.Column(db.String(200))
    photo_url = db.Column(db.String(500))
    user_id = db.Column(db.String(100))
    verified = db.Column(db.Boolean, default=False)
    verification_count = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'type': self.type,
            'lat': self.lat,
            'lng': self.lng,
            'description': self.description,
            'verified': self.verified,
            'verification_count': self.verification_count,
            'time_ago': self.get_time_ago()
        }
    
    def get_time_ago(self):
        diff = datetime.utcnow() - self.created_at
        if diff.days > 0:
            return f"{diff.days}d ago"
        elif diff.seconds > 3600:
            return f"{diff.seconds // 3600}h ago"
        elif diff.seconds > 60:
            return f"{diff.seconds // 60}m ago"
        return "Just now"

class UserActivity(db.Model):
    __tablename__ = 'user_activities'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.String(100))
    action = db.Column(db.String(50))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)