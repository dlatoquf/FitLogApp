import uvicorn
from fastapi import FastAPI
from member_workout import app as member_app
from member_dietlog import app as member_dietlog_app
from trainer_dashboard import app as trainer_dashboard_app
from trainer_member_management import app as trainer_member_app

app = FastAPI()

for route in member_app.routes:
    app.routes.append(route)

for route in member_dietlog_app.routes:
    app.routes.append(route)

for route in trainer_dashboard_app.routes:
    app.routes.append(route)

for route in trainer_member_app.routes:
    app.routes.append(route)

if __name__ == "__main__":
    uvicorn.run("run:app", host="0.0.0.0", port=8001, reload=True)
