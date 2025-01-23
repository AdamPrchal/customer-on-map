import React, { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import { Map as LeafletMap } from "leaflet";
import { utils, read } from "xlsx";
import "leaflet/dist/leaflet.css";
import { divIcon } from "leaflet";
import { renderToStaticMarkup } from "react-dom/server";
import { LoaderCircle } from "lucide-react";

interface Person {
  city: string;
  year: number;
  name: string;
  device: string;
}

interface PersonWithLocation extends Person {
  location?: { lat: number; lng: number };
}

const addRandomOffset = (location: { lat: number; lng: number }) => {
  const offsetLat = (Math.random() - 0.5) * 0.005; // Small offset for latitude
  const offsetLng = (Math.random() - 0.5) * 0.005; // Small offset for longitude
  return {
    lat: location.lat + offsetLat,
    lng: location.lng + offsetLng,
  };
};

const tailwindColorNames = [
  "border-gray-500",
  "border-red-500",
  "border-yellow-500",
  "border-blue-500",
  "border-indigo-500",
  "border-purple-500",
  "border-pink-500",
  "border-amber-500",
  "border-lime-500",
  "border-emerald-500",
  "border-teal-500",
  "border-cyan-500",
  "border-sky-500",
  "border-violet-500",
  "border-fuchsia-500",
  "border-rose-500",
  "border-slate-500",
  "border-zinc-500",
  "border-neutral-500",
  "border-stone-500",
];

const Map = () => {
  const [file, setFile] = useState<File | null>(null);
  const [people, setPeople] = useState<PersonWithLocation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [totalPeople, setTotalPeople] = useState(0);
  const [processedPeople, setProcessedPeople] = useState(0);
  const [filteredYear, setFilteredYear] = useState<string>("");

  const [map, setMap] = useState<LeafletMap | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target?.files && event.target?.files[0]) {
      setFile(event.target.files[0]);
    }
  };

  useEffect(() => {
    const fetchCityLocation = async (
      person: Person
    ): Promise<PersonWithLocation> => {
      const response = await fetch(
        `https://photon.adamprchal.com/api?q=${encodeURIComponent(
          person.city
        )}&layer=city&limit=1`
      );
      const data = await response.json();

      setProcessedPeople((state) => state + 1);
      if (data.features && data.features[0]) {
        return {
          ...person,
          location: addRandomOffset({
            lat: data.features[0].geometry.coordinates[1],
            lng: data.features[0].geometry.coordinates[0],
          }),
        };
      }
      return person;
    };

    const processFile = async () => {
      setIsLoading(true);

      if (file === null) {
        return;
      }
      const data = await file.arrayBuffer();
      const workbook = read(data, {
        cellText: false,
        cellDates: true,
      });

      const firstSheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[firstSheetName];
      const rows = utils.sheet_to_json(sheet, {
        raw: false,
        dateNF: "yyyy-mm-dd",
      }) as Record<string, string>[];
      const foundPeople: Person[] = rows
        .filter((row) => !!row["Bydliště"])
        .map((row) => ({
          city: row["Bydliště"].replace(/[0-9]/g, ""),
          year: new Date(Date.parse(row["Datum prodeje"])).getFullYear(),
          name: `${row["Jméno"] ?? ""} ${row["Přijmení"] ?? ""}`,
          device: row["Typ"],
        }));

      setTotalPeople(foundPeople.length);
      setProcessedPeople(0);

      try {
        const assignedPeople = await Promise.all(
          foundPeople.map(async (person) => {
            const personWithLocation = await fetchCityLocation(person);
            setProcessedPeople((prev) => prev + 1);
            return personWithLocation;
          })
        );

        const filteredAndSortedPeople = assignedPeople
          .filter((element) => element !== null)
          .sort((a, b) => a.year - b.year) as PersonWithLocation[];

        setPeople(filteredAndSortedPeople);
      } catch (error) {
        console.error("Error fetching locations:", error);
      }
      setIsLoading(false);
    };
    if (file) {
      processFile();
    }
  }, [file]);

  const colorMap: Record<string, string> = {};
  let colorIndex = 0;

  people.forEach((item) => {
    if (!colorMap[item.year]) {
      colorMap[item.year] =
        tailwindColorNames[colorIndex % tailwindColorNames.length];
      colorIndex++;
    }
  });

  const kyjovLocation = { lat: 49.01018, lng: 17.12253 };

  const filteredPeople =
    filteredYear === ""
      ? people
      : people.filter((person) => person.year === Number(filteredYear));
  return (
    <div className="grid grid-cols-[40ch_1fr] h-dvh max-h-dvh ">
      <nav className="px-8 py-4 space-y-4 overflow-y-auto">
        <h1 className="text-3xl font-bold">Zákazníci na mapě 📍</h1>

        <label
          className="text-xl rounded-md font-medium p-4 border border-neutral-300 bg-neutral-100 flex gap-2 flex-col
        "
          htmlFor="file-input"
        >
          Nahraj dokument
          <input
            type="file"
            id="file-input"
            accept=".ods"
            onChange={handleFileChange}
          />
        </label>
        <label className="py-2 flex flex-col gap-1">
          Filtrovat rok:
          <select
            value={filteredYear}
            onChange={(e) => setFilteredYear(e.target.value)} // .
          >
            <option value="">---</option>
            {Object.keys(colorMap).map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </label>
        {isLoading && (
          <div className="mx-auto flex flex-col gap-2 items-center justify-center">
            <LoaderCircle size={32} className="text-black animate-spin" />
            <p>Načítání</p>
            <p>
              {processedPeople}/{totalPeople}
            </p>
          </div>
        )}
        <ul className="space-y-4 overflow-y-auto">
          {filteredPeople.map((person, index) => (
            <li
              className={`hover:bg-neutral-100 border-l-8 pl-4 cursor-pointer ${
                colorMap[person.year]
              }`}
              key={index + person.name + person.year}
              onClick={() => {
                if (person.location && map) {
                  map.setView(person.location, 14);
                }
              }}
            >
              <div className="flex gap-0 flex-col min-w-32">
                <time dateTime={person.year.toString()}>{person.year}</time>
                <h3 className="font-bold">{person.name}</h3>
                <span>{person.device}</span>
                <span>{person.city}</span>
              </div>
            </li>
          ))}
        </ul>
      </nav>

      <MapContainer className="" center={kyjovLocation} zoom={13} ref={setMap}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {filteredPeople.map((person, index) => {
          if (person.location) {
            return (
              <Marker
                icon={divIcon({
                  html: renderToStaticMarkup(
                    <div
                      className={`${
                        colorMap[person.year]
                      } border-8 size-6 bg-white rounded-full -translate-x-1/2 shadow-[0px_0px_5px_1px_rgba(0,0,0,0.75)]`}
                    ></div>
                  ),
                  iconSize: [0, 0],
                })}
                key={index + person.name + person.year}
                position={person.location}
              >
                <Popup>
                  <div className="flex gap-1 flex-col min-w-32">
                    <time dateTime={person.year.toString()}>{person.year}</time>
                    <h3 className="font-bold">{person.name}</h3>
                    <span>{person.device}</span>
                    <span>{person.city}</span>
                  </div>
                </Popup>
              </Marker>
            );
          }
          return null;
        })}
      </MapContainer>
    </div>
  );
};

export default Map;
