// Get your token from https://cesium.com/ion/tokens
Cesium.Ion.defaultAccessToken =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJlYWE1OWUxNy1mMWZiLTQzYjYtYTQ0OS1kMWFjYmFkNjc5YzciLCJpZCI6NTc3MzMsImlhdCI6MTYyNzg0NTE4Mn0.XcKpgANiY19MC4bdFUXMVEBToBmqS8kuYpUlxJHYZxk";

//create cesium Container
const viewer = new Cesium.Viewer("cesiumContainer", {
  terrainProvider: Cesium.createWorldTerrain(),
  shouldAnimate: false,
});

const osmBuildings = viewer.scene.primitives.add(Cesium.createOsmBuildings());

const getJson = async () => {
  return await fetch("./test.json").then((res) => res.json());
};

const times = [];
const positions = [];
const startTime = Cesium.JulianDate.now();

const flight = async () => {
  const airplaneUri = "./path/no1.glb";
  const flightData = await getJson();

  const startCoordinate = flightData[0];
  const startPosition = Cesium.Cartesian3.fromDegrees(
    startCoordinate.longitude,
    startCoordinate.latitude,
    startCoordinate.height
  );

  const targetCoordinate = flightData[2];
  const targetPosition = Cesium.Cartesian3.fromDegrees(
    targetCoordinate.longitude,
    targetCoordinate.latitude,
    targetCoordinate.height
  );

  const timeStepInSeconds = 30;
  const totalSeconds = timeStepInSeconds * (flightData.length - 1);
  const start = Cesium.JulianDate.fromDate(new Date(2019, 5, 10, 13));
  const stop = Cesium.JulianDate.addSeconds(
    start,
    timeStepInSeconds * flightData.length,
    new Cesium.JulianDate()
  );
  viewer.clock.startTime = start.clone();
  viewer.clock.stopTime = stop.clone();
  viewer.clock.currentTime = start.clone();
  viewer.timeline.zoomTo(start, stop);
  // Speed up the playback speed 50x.
  viewer.clock.multiplier = 5;
  // Start playing the scene.geatigoonore
  viewer.clock.shouldAnimate = false;

  flightData.forEach((point, index) => {
    const time = Cesium.JulianDate.addSeconds(
      startTime,
      index * 10,
      new Cesium.JulianDate()
    );
    const position = Cesium.Cartesian3.fromDegrees(
      point.longitude,
      point.latitude,
      point.height
    );
    times.push(Cesium.JulianDate.secondsDifference(time, startTime));
    positions.push(position);
  });

  const spline = new Cesium.CatmullRomSpline({
    times: times,
    points: positions,
  });
  const pointss = [];
  //위치값 계산
  const computePositionProperty = () => {
    const property = new Cesium.SampledPositionProperty();

    for (let t = times[0]; t <= times[times.length - 1]; t += 1) {
      const time = Cesium.JulianDate.addSeconds(
        startTime,
        t,
        new Cesium.JulianDate()
      );
      pointss.push(spline.evaluate(t));
    }

    for (let i = 0; i < flightData.length; i++) {
      const dataPoint = flightData[i];
      const time = Cesium.JulianDate.addSeconds(
        start,
        i * timeStepInSeconds,
        new Cesium.JulianDate()
      );

      const positionss = Cesium.Cartesian3.fromDegrees(
        dataPoint.longitude,
        dataPoint.latitude,
        dataPoint.height
      );

      property.addSample(time, positionss);
    }

    return property;
  };

  const computeOrientation = () => {
    const property = new Cesium.TimeIntervalCollectionProperty();

    return property;
  };

  // 방위각 계산 함수
  function calculateCorrectBearing(startLat, startLon, endLat, endLon) {
    const startLatRad = Cesium.Math.toRadians(startLat);
    const startLonRad = Cesium.Math.toRadians(startLon);
    const endLatRad = Cesium.Math.toRadians(endLat);
    const endLonRad = Cesium.Math.toRadians(endLon);

    const dLon = endLonRad - startLonRad;

    const y = Math.sin(dLon) * Math.cos(endLatRad);
    const x =
      Math.cos(startLatRad) * Math.sin(endLatRad) -
      Math.sin(startLatRad) * Math.cos(endLatRad) * Math.cos(dLon);

    const bearing = Math.atan2(y, x);
    let bearingDegrees = Cesium.Math.toDegrees(bearing);
    bearingDegrees = (bearingDegrees + 360) % 360;

    return bearingDegrees;
  }

  // 방위각 계산 함수
  function calculateBearingUsingCesium(startLat, startLon, endLat, endLon) {
    const startCartographic = Cesium.Cartographic.fromDegrees(
      startLon,
      startLat
    );
    const endCartographic = Cesium.Cartographic.fromDegrees(endLon, endLat);

    const startCartesian = Cesium.Cartesian3.fromRadians(
      startCartographic.longitude,
      startCartographic.latitude,
      0
    );
    const endCartesian = Cesium.Cartesian3.fromRadians(
      endCartographic.longitude,
      endCartographic.latitude,
      0
    );

    const vector = Cesium.Cartesian3.subtract(
      endCartesian,
      startCartesian,
      new Cesium.Cartesian3()
    );
    Cesium.Cartesian3.normalize(vector, vector);

    const eastVector = Cesium.Cartesian3.cross(
      Cesium.Cartesian3.UNIT_Z,
      startCartesian,
      new Cesium.Cartesian3()
    );
    Cesium.Cartesian3.normalize(eastVector, eastVector);

    const northVector = Cesium.Cartesian3.cross(
      Cesium.Cartesian3.UNIT_Z,
      eastVector,
      new Cesium.Cartesian3()
    );
    Cesium.Cartesian3.normalize(northVector, northVector);

    const bearing = Math.atan2(
      Cesium.Cartesian3.dot(vector, eastVector),
      Cesium.Cartesian3.dot(vector, northVector)
    );
    const bearingDegrees = Cesium.Math.toDegrees(bearing);

    return (bearingDegrees + 360) % 360;
  }

  viewer.entities.add({
    polyline: {
      positions: pointss,
      arcType: Cesium.ArcType.GEODESIC,
      width: 10,
      material: new Cesium.PolylineArrowMaterialProperty(Cesium.Color.YELLOW),
    },
  });
  const positionProperty = computePositionProperty();
  // const orientationProperty = computeOrientation();
  // 비행기객체 관련 데이터 추가
  const airplaneEntity = viewer.entities.add({
    availability: new Cesium.TimeIntervalCollection([
      new Cesium.TimeInterval({ start: start, stop: stop }),
    ]),
    position: positionProperty,
    // orientation: orientationProperty,

    path: {
      resolution: 1,
      material: new Cesium.PolylineGlowMaterialProperty({
        glowPower: 0.1,
        color: Cesium.Color.RED,
      }),
      width: 10,
    },
    model: {
      uri: airplaneUri,
      minimumPixelSize: 64,
      maximumScale: 100,
    },
  });
  viewer.trackedEntity = airplaneEntity;

  // 방향 벡터 계산
  const direction = Cesium.Cartesian3.subtract(
    targetPosition,
    startPosition,
    new Cesium.Cartesian3()
  );
  Cesium.Cartesian3.normalize(direction, direction);
  const bearing = calculateBearingUsingCesium(
    startCoordinate.latitude,
    startCoordinate.longitude,
    targetCoordinate.latitude,
    targetCoordinate.longitude
  );

  // heading 계산
  const heading2 = Cesium.Math.toRadians(bearing);
  const heading = Math.atan2(direction.y, direction.x);
  console.log(heading2, Cesium.Math.toDegrees(heading2));
  // console.log(heading2, Cesium.Math.toDegrees(heading2));
  // 모델의 방향 설정
  const hpr = new Cesium.HeadingPitchRoll(heading2, 0.0, 0.0);
  airplaneEntity.orientation = Cesium.Transforms.headingPitchRollQuaternion(
    startPosition,
    hpr
  );
};
flight();
